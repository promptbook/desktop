import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Notebook,
  NotebookState,
  CellState,
  CellOutput,
  CellType,
  createEmptyNotebook,
  createCodeCell,
  createTextCell,
  KernelStatus,
  EnvironmentPicker,
  VariableInspector,
  Variable,
  FindReplace,
  SearchMatch,
} from '@promptbook/core/ui';
import { Settings, AppSettings, defaultSettings } from './Settings';

// Types for kernel
export interface KernelOutput {
  type: 'stdout' | 'stderr' | 'result' | 'display' | 'error' | 'status';
  content: string;
  mimeType?: string;
  executionCount?: number;
}

export interface PythonEnvironment {
  path: string;
  name: string;
  version: string;
  type: 'venv' | 'conda' | 'system' | 'pyenv' | 'pipenv';
  hasIpykernel: boolean;
}

export type KernelState = 'idle' | 'busy' | 'starting' | 'dead' | 'disconnected';

// Type for the preload API
declare global {
  interface Window {
    promptbook: {
      kernel: {
        getEnvironments: () => Promise<PythonEnvironment[]>;
        scanEnvironments: () => Promise<PythonEnvironment[]>;
        selectEnvironment: (pythonPath: string) => Promise<{
          success: boolean;
          error?: string;
          needsInstall?: boolean;
        }>;
        installIpykernel: (pythonPath: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        testPython: (pythonPath: string) => Promise<{
          success: boolean;
          hasIpykernel?: boolean;
        }>;
        createVenv: (venvName?: string) => Promise<{
          success: boolean;
          pythonPath?: string;
          error?: string;
        }>;
        execute: (code: string) => Promise<{
          success: boolean;
          msgId?: string;
          outputs?: KernelOutput[];
          error?: string;
          needsEnvironment?: boolean;
        }>;
        interrupt: () => Promise<{ success: boolean; error?: string }>;
        restart: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ state: KernelState; executionCount: number }>;
        getVariables: () => Promise<{
          success: boolean;
          variables: Variable[];
          error?: string;
        }>;
        onOutput: (callback: (output: KernelOutput, msgId: string) => void) => () => void;
        onStateChange: (callback: (state: KernelState) => void) => () => void;
        onError: (callback: (error: string) => void) => () => void;
      };
      ai: {
        sync: (
          cellId: string,
          direction: string,
          context: {
            newContent: string;
            previousContent?: string;
            existingCounterpart?: string;
          }
        ) => Promise<{ success: boolean; result?: string; error?: string }>;
      };
      file: {
        open: () => Promise<string | undefined>;
        read: (path: string) => Promise<NotebookState>;
        save: (path: string, notebook: NotebookState) => Promise<{ success: boolean }>;
        saveAs: (notebook: NotebookState) => Promise<{ success: boolean; filePath: string | null }>;
        exportPython: (notebook: NotebookState) => Promise<{ success: boolean; filePath: string | null }>;
      };
      settings: {
        load: () => Promise<AppSettings>;
        save: (settings: AppSettings) => Promise<{ success: boolean }>;
      };
      clipboard: {
        read: () => Promise<string>;
        write: (text: string) => Promise<{ success: boolean }>;
        readHTML: () => Promise<string>;
        writeHTML: (html: string) => Promise<{ success: boolean }>;
      };
      spellcheck: {
        getLanguages: () => Promise<string[]>;
        setLanguages: (languages: string[]) => Promise<{ success: boolean }>;
        addWord: (word: string) => Promise<{ success: boolean }>;
      };
      version: {
        save: (notebookId: string, content: string, message: string) => Promise<{
          success: boolean;
          hash?: string;
          error?: string;
        }>;
        getHistory: (notebookId: string) => Promise<{
          success: boolean;
          history: Array<{ hash: string; message: string; timestamp: string }>;
          error?: string;
        }>;
        undo: (notebookId: string) => Promise<{
          success: boolean;
          content?: string;
          hash?: string;
          error?: string;
        }>;
        canUndo: (notebookId: string) => Promise<{
          success: boolean;
          canUndo: boolean;
          error?: string;
        }>;
        getVersion: (notebookId: string, hash: string) => Promise<{
          success: boolean;
          content?: string;
          error?: string;
        }>;
      };
    };
  }
}

// Helper functions for parameter handling
function extractParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /\{\{([^:}]+):([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    params[match[1].trim()] = match[2].trim();
  }
  return params;
}

function getParamChanges(
  oldParams: Record<string, string>,
  newParams: Record<string, string>
): { added: string[]; removed: string[]; changed: Record<string, { old: string; new: string }> } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Record<string, { old: string; new: string }> = {};

  // Check for changed and removed params
  for (const [name, oldValue] of Object.entries(oldParams)) {
    if (!(name in newParams)) {
      removed.push(name);
    } else if (newParams[name] !== oldValue) {
      changed[name] = { old: oldValue, new: newParams[name] };
    }
  }

  // Check for added params
  for (const name of Object.keys(newParams)) {
    if (!(name in oldParams)) {
      added.push(name);
    }
  }

  return { added, removed, changed };
}

function applyParamChangesToCode(code: string, changes: Record<string, { old: string; new: string }>): string {
  let result = code;
  for (const { old: oldValue, new: newValue } of Object.values(changes)) {
    // Replace old value with new value in code
    // Be careful to replace as whole values, not partial matches
    const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the value as a standalone token (number, string literal, or identifier)
    const patterns = [
      new RegExp(`\\b${escapedOld}\\b`, 'g'), // As a word/number
      new RegExp(`"${escapedOld}"`, 'g'),     // As a double-quoted string
      new RegExp(`'${escapedOld}'`, 'g'),     // As a single-quoted string
    ];
    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, (match) => {
          if (match.startsWith('"')) return `"${newValue}"`;
          if (match.startsWith("'")) return `'${newValue}'`;
          return newValue;
        });
        break; // Found and replaced
      }
    }
  }
  return result;
}

function applyParamChangesToDescription(text: string, changes: Record<string, { old: string; new: string }>): string {
  let result = text;
  for (const [name, { old: oldValue, new: newValue }] of Object.entries(changes)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedName}:${escapedOld}\\}\\}`, 'g');
    result = result.replace(regex, `{{${name}:${newValue}}}`);
  }
  return result;
}

// SVG Icons
const Icons = {
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4.5a1 1 0 0 1 1-1h3.172a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8z" />
    </svg>
  ),
  save: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.414a1 1 0 0 0-.293-.707l-2.414-2.414A1 1 0 0 0 9.586 2H4a1 1 0 0 0-1 1z" />
      <path d="M5 2v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V2" />
      <path d="M5 14v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2" />
      <path d="M13.5 8a5.5 5.5 0 0 0-.1-1.1l1.3-.9a.3.3 0 0 0 .1-.4l-1.2-2.1a.3.3 0 0 0-.4-.1l-1.5.6a5 5 0 0 0-1-.6l-.2-1.6a.3.3 0 0 0-.3-.3H7.8a.3.3 0 0 0-.3.3l-.2 1.6a5 5 0 0 0-1 .6l-1.5-.6a.3.3 0 0 0-.4.1L3.2 5.6a.3.3 0 0 0 .1.4l1.3.9A5.5 5.5 0 0 0 4.5 8c0 .4 0 .7.1 1.1l-1.3.9a.3.3 0 0 0-.1.4l1.2 2.1a.3.3 0 0 0 .4.1l1.5-.6a5 5 0 0 0 1 .6l.2 1.6a.3.3 0 0 0 .3.3h2.4a.3.3 0 0 0 .3-.3l.2-1.6a5 5 0 0 0 1-.6l1.5.6a.3.3 0 0 0 .4-.1l1.2-2.1a.3.3 0 0 0-.1-.4l-1.3-.9a5.5 5.5 0 0 0 .1-1.1z" />
    </svg>
  ),
  logo: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Notebook base */}
      <rect x="4" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Binding */}
      <path d="M4 7h14M4 17h14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {/* AI sparkle */}
      <path d="M11 10l1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L11 10z" fill="currentColor" opacity="0.9" />
    </svg>
  ),
  runAll: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 3l8 5-8 5V3z" fill="currentColor" />
      <path d="M13 3v10" />
    </svg>
  ),
  clearOutputs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  ),
  chevronDown: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  ),
  variables: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M3 8h7M3 12h4" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="10" cy="12" r="2" />
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v9M4 7l4-5 4 5" />
      <path d="M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
    </svg>
  ),
  undo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h7a4 4 0 0 1 0 8H8" />
      <path d="M6 3L3 6l3 3" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3 3" />
    </svg>
  ),
};

export function App() {
  const [notebook, setNotebook] = useState<NotebookState>(createEmptyNotebook());
  const [filePath, setFilePath] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Kernel state
  const [kernelState, setKernelState] = useState<KernelState>('disconnected');
  const [environments, setEnvironments] = useState<PythonEnvironment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<PythonEnvironment | null>(null);
  const [environmentPickerOpen, setEnvironmentPickerOpen] = useState(false);
  const [isInstallingIpykernel, setIsInstallingIpykernel] = useState(false);
  const [isCreatingVenv, setIsCreatingVenv] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Active cell tracking for keyboard shortcuts
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [copiedCell, setCopiedCell] = useState<CellState | null>(null);
  const [commandMode, setCommandMode] = useState(true); // true = command mode, false = edit mode

  // Variable inspector
  const [variableInspectorOpen, setVariableInspectorOpen] = useState(false);

  // Version control
  const [canUndo, setCanUndo] = useState(false);
  const notebookId = filePath ? filePath.replace(/[^a-zA-Z0-9]/g, '_') : `untitled_${Date.now()}`;

  // Find & Replace
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings and environments on mount, auto-connect to best venv
  useEffect(() => {
    window.promptbook.settings.load().then(setSettings);
    window.promptbook.kernel.getStatus().then(({ state }) => setKernelState(state));

    // Auto-connect to best available environment
    window.promptbook.kernel.scanEnvironments().then(async (envs) => {
      setEnvironments(envs);

      // Skip auto-connect if already connected
      const status = await window.promptbook.kernel.getStatus();
      if (status.state !== 'disconnected' && status.state !== 'dead') {
        return;
      }

      // Priority 1: Local project venv (./.venv or ./venv)
      const localVenv = envs.find(
        (e) => e.type === 'venv' && (e.name === '.venv' || e.name === 'venv')
      );

      // Priority 2: First environment with ipykernel installed
      const withIpykernel = envs.find((e) => e.hasIpykernel);

      const autoEnv = localVenv || withIpykernel;
      if (autoEnv) {
        handleSelectEnvironment(autoEnv);
      }
    });
  }, []);

  // Set initial active cell when notebook loads
  useEffect(() => {
    if (notebook.cells.length > 0 && !activeCellId) {
      setActiveCellId(notebook.cells[0].id);
    }
  }, [notebook.cells, activeCellId]);

  // Track notebook changes for auto-save
  const lastNotebookStateRef = useRef<string>(JSON.stringify(notebook));
  useEffect(() => {
    const currentState = JSON.stringify(notebook);
    if (currentState !== lastNotebookStateRef.current) {
      setHasUnsavedChanges(true);
    }
    lastNotebookStateRef.current = currentState;
  }, [notebook]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const autoSave = async () => {
      if (hasUnsavedChanges && filePath) {
        try {
          await window.promptbook.file.save(filePath, notebook);
          setHasUnsavedChanges(false);
          setLastSavedAt(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    };

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up new interval (30 seconds)
    autoSaveIntervalRef.current = setInterval(autoSave, 30000);

    // Cleanup on unmount
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [hasUnsavedChanges, filePath, notebook]);

  // Set up kernel event listeners
  useEffect(() => {
    const unsubscribeState = window.promptbook.kernel.onStateChange((state) => {
      setKernelState(state);
    });

    const unsubscribeError = window.promptbook.kernel.onError((error) => {
      setGlobalError(`Kernel error: ${error}`);
    });

    return () => {
      unsubscribeState();
      unsubscribeError();
    };
  }, []);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await window.promptbook.settings.save(newSettings);
    setSettings(newSettings);
  };

  const handleSelectEnvironment = async (env: PythonEnvironment) => {
    setInstallError(null);

    if (!env.hasIpykernel) {
      // Need to install ipykernel first
      setIsInstallingIpykernel(true);
      try {
        const result = await window.promptbook.kernel.installIpykernel(env.path);
        setIsInstallingIpykernel(false);

        if (!result.success) {
          setInstallError(result.error || 'Failed to install ipykernel');
          return;
        }

        // Refresh environments to get updated hasIpykernel status
        const updatedEnvs = await window.promptbook.kernel.scanEnvironments();
        setEnvironments(updatedEnvs);
        env = updatedEnvs.find((e) => e.path === env.path) || env;
      } catch (err) {
        setIsInstallingIpykernel(false);
        setInstallError(String(err));
        return;
      }
    }

    const result = await window.promptbook.kernel.selectEnvironment(env.path);
    if (result.success) {
      setSelectedEnvironment(env);
      setEnvironmentPickerOpen(false);
    } else {
      setInstallError(result.error || 'Failed to select environment');
    }
  };

  const handleRefreshEnvironments = async () => {
    const envs = await window.promptbook.kernel.scanEnvironments();
    setEnvironments(envs);
  };

  const handleCreateVenv = async (name: string): Promise<{ success: boolean; error?: string }> => {
    setIsCreatingVenv(true);
    try {
      const result = await window.promptbook.kernel.createVenv(name);
      if (result.success) {
        // Refresh environments to show the new venv
        const envs = await window.promptbook.kernel.scanEnvironments();
        setEnvironments(envs);
      }
      return result;
    } finally {
      setIsCreatingVenv(false);
    }
  };

  const handleInterrupt = async () => {
    await window.promptbook.kernel.interrupt();
  };

  const handleRestart = async () => {
    await window.promptbook.kernel.restart();
  };

  const handleUpdate = useCallback(
    (cellId: string, updates: Partial<CellState>) => {
      setNotebook((prev) => ({
        ...prev,
        cells: prev.cells.map((cell) =>
          cell.id === cellId ? { ...cell, ...updates } : cell
        ),
        metadata: { ...prev.metadata, modified: new Date().toISOString() },
      }));
    },
    []
  );

  // Save a version to git (defined before handleRunCell which depends on it)
  const handleSaveVersion = useCallback(async (message: string) => {
    const content = JSON.stringify(notebook, null, 2);
    await window.promptbook.version.save(notebookId, content, message);
    const canUndoResult = await window.promptbook.version.canUndo(notebookId);
    setCanUndo(canUndoResult.canUndo);
  }, [notebook, notebookId]);

  // Undo to previous version
  const handleUndo = useCallback(async () => {
    const result = await window.promptbook.version.undo(notebookId);
    if (result.success && result.content) {
      try {
        const restored = JSON.parse(result.content);
        setNotebook(restored);
        const canUndoResult = await window.promptbook.version.canUndo(notebookId);
        setCanUndo(canUndoResult.canUndo);
      } catch {
        setGlobalError('Failed to restore version');
      }
    }
  }, [notebookId]);

  const handleRunCell = useCallback(
    async (cellId: string) => {
      let cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell || cell.cellType === 'text') return;

      // Check if we have a kernel
      const status = await window.promptbook.kernel.getStatus();
      if (status.state === 'disconnected' || status.state === 'dead') {
        // Need to select an environment first
        setEnvironmentPickerOpen(true);
        return;
      }

      const hasDescription = cell.shortDescription?.trim() || cell.fullDescription?.trim();
      const hasCode = cell.code?.trim();

      // If cell is dirty, check if it's just a parameter change
      if (cell.isDirty && hasDescription && hasCode) {
        // Extract current params from descriptions
        const currentShortParams = extractParams(cell.shortDescription || '');
        const currentFullParams = extractParams(cell.fullDescription || '');
        const currentParams = { ...currentShortParams, ...currentFullParams };

        // Check if we have lastSyncedParams to compare against
        if (cell.lastSyncedParams) {
          const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

          // If only values changed (no structural changes), do direct replacement
          if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
            // Apply changes directly without LLM
            const newCode = applyParamChangesToCode(cell.code, changed);
            const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
            const newFull = applyParamChangesToDescription(cell.fullDescription || '', changed);

            handleUpdate(cellId, {
              code: newCode,
              shortDescription: newShort,
              fullDescription: newFull,
              lastSyncedCode: newCode,
              lastSyncedShort: newShort,
              lastSyncedFull: newFull,
              lastSyncedParams: currentParams,
              isDirty: false,
            });
            cell = { ...cell, code: newCode, shortDescription: newShort, fullDescription: newFull };
          }
        }
      }

      // If cell is still dirty after param check, sync with AI
      if (cell.isDirty && hasDescription) {
        handleUpdate(cellId, { isSyncing: true });

        try {
          // Determine which description to use for code generation
          const description = cell.fullDescription?.trim() || cell.shortDescription?.trim();
          const syncResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
            newContent: description || '',
            previousContent: cell.lastSyncedFull,
            existingCounterpart: cell.code,
          });

          if (syncResult.success && syncResult.result) {
            const generatedCode = syncResult.result;

            // Sync back to generate/update descriptions from the code
            const [shortResult, fullResult] = await Promise.all([
              window.promptbook.ai.sync(cellId, 'codeToShort', {
                newContent: generatedCode,
                existingCounterpart: cell.shortDescription,
              }),
              window.promptbook.ai.sync(cellId, 'codeToFull', {
                newContent: generatedCode,
                existingCounterpart: cell.fullDescription,
              }),
            ]);

            const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
            const newFull = fullResult.success ? fullResult.result || cell.fullDescription : cell.fullDescription;

            // Extract params from the synced descriptions for future comparison
            const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

            handleUpdate(cellId, {
              code: generatedCode,
              shortDescription: newShort,
              fullDescription: newFull,
              lastSyncedCode: generatedCode,
              lastSyncedShort: newShort,
              lastSyncedFull: newFull,
              lastSyncedParams: syncedParams,
              isDirty: false,
              isSyncing: false,
            });
            cell = { ...cell, code: generatedCode, shortDescription: newShort, fullDescription: newFull };

            // Save version after AI sync
            handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
          } else {
            handleUpdate(cellId, { isSyncing: false });
            if (syncResult.error) {
              setGlobalError(syncResult.error);
            }
            return;
          }
        } catch (error) {
          handleUpdate(cellId, { isSyncing: false });
          setGlobalError(String(error));
          return;
        }
      }

      // If we have description but no code, generate code first
      if (hasDescription && !hasCode) {
        handleUpdate(cellId, { isSyncing: true });

        try {
          const description = cell.fullDescription?.trim() || cell.shortDescription?.trim();
          const syncResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
            newContent: description || '',
            existingCounterpart: cell.code,
          });

          if (syncResult.success && syncResult.result) {
            const generatedCode = syncResult.result;

            // Now sync back to generate/update descriptions from the code
            const [shortResult, fullResult] = await Promise.all([
              window.promptbook.ai.sync(cellId, 'codeToShort', {
                newContent: generatedCode,
                existingCounterpart: cell.shortDescription,
              }),
              window.promptbook.ai.sync(cellId, 'codeToFull', {
                newContent: generatedCode,
                existingCounterpart: cell.fullDescription,
              }),
            ]);

            const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
            const newFull = fullResult.success ? fullResult.result || cell.fullDescription : cell.fullDescription;

            // Extract params from the synced descriptions for future comparison
            const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

            handleUpdate(cellId, {
              code: generatedCode,
              shortDescription: newShort,
              fullDescription: newFull,
              lastSyncedCode: generatedCode,
              lastSyncedShort: newShort,
              lastSyncedFull: newFull,
              lastSyncedParams: syncedParams,
              isDirty: false,
              isSyncing: false,
            });
            cell = { ...cell, code: generatedCode, shortDescription: newShort, fullDescription: newFull };

            // Save version after AI sync
            handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
          } else {
            handleUpdate(cellId, { isSyncing: false });
            if (syncResult.error) {
              setGlobalError(syncResult.error);
            }
            return;
          }
        } catch (error) {
          handleUpdate(cellId, { isSyncing: false });
          setGlobalError(String(error));
          return;
        }
      }

      // Now execute the code
      const startTime = Date.now();
      const executionCount = (cell.executionCount || 0) + 1;
      handleUpdate(cellId, {
        isExecuting: true,
        outputs: [],
        executionStartTime: startTime,
        executionCount,
      });

      try {
        const result = await window.promptbook.kernel.execute(cell.code);
        const executionTime = Date.now() - startTime;

        if (result.needsEnvironment) {
          handleUpdate(cellId, {
            isExecuting: false,
            executionStartTime: undefined,
          });
          setEnvironmentPickerOpen(true);
          return;
        }

        if (result.success && result.outputs) {
          const cellOutputs: CellOutput[] = result.outputs.map((output) => ({
            type: output.type as CellOutput['type'],
            content: output.content,
            mimeType: output.mimeType,
          }));

          handleUpdate(cellId, {
            isExecuting: false,
            outputs: cellOutputs,
            executionStartTime: undefined,
            lastExecutionTime: executionTime,
            lastExecutionSuccess: true,
          });
        } else {
          handleUpdate(cellId, {
            isExecuting: false,
            outputs: [{ type: 'error', content: result.error || 'Execution failed' }],
            executionStartTime: undefined,
            lastExecutionTime: executionTime,
            lastExecutionSuccess: false,
          });
        }
      } catch (error) {
        const executionTime = Date.now() - startTime;
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: [{ type: 'error', content: String(error) }],
          executionStartTime: undefined,
          lastExecutionTime: executionTime,
          lastExecutionSuccess: false,
        });
      }
    },
    [notebook.cells, handleUpdate, handleSaveVersion]
  );

  // Cell manipulation callbacks (defined before useEffect that depends on them)
  const handleAddCell = useCallback((afterCellId?: string, cellType: CellType = 'code') => {
    const newCell = cellType === 'text'
      ? createTextCell(`cell-${Date.now()}`)
      : createCodeCell(`cell-${Date.now()}`);
    setNotebook((prev) => {
      if (!afterCellId) {
        return { ...prev, cells: [...prev.cells, newCell] };
      }
      const index = prev.cells.findIndex((c) => c.id === afterCellId);
      const newCells = [...prev.cells];
      newCells.splice(index + 1, 0, newCell);
      return { ...prev, cells: newCells };
    });
  }, []);

  const handleMoveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
    setNotebook((prev) => {
      const index = prev.cells.findIndex((c) => c.id === cellId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.cells.length) return prev;

      const newCells = [...prev.cells];
      const [movedCell] = newCells.splice(index, 1);
      newCells.splice(newIndex, 0, movedCell);

      return { ...prev, cells: newCells };
    });
  }, []);

  const handleDeleteCell = useCallback((cellId: string) => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.filter((c) => c.id !== cellId),
    }));
  }, []);

  // Run All Cells sequentially
  const handleRunAllCells = useCallback(async () => {
    const codeCells = notebook.cells.filter((c) => c.cellType === 'code');
    for (const cell of codeCells) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, handleRunCell]);

  // Copy cell to clipboard
  const handleCopyCell = useCallback(() => {
    if (!activeCellId) return;
    const cell = notebook.cells.find((c) => c.id === activeCellId);
    if (cell) {
      setCopiedCell({ ...cell });
    }
  }, [activeCellId, notebook.cells]);

  // Cut cell (copy + delete)
  const handleCutCell = useCallback(() => {
    if (!activeCellId) return;
    handleCopyCell();
    handleDeleteCell(activeCellId);
    // Move to next cell
    const index = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (index < notebook.cells.length - 1) {
      setActiveCellId(notebook.cells[index + 1].id);
    } else if (index > 0) {
      setActiveCellId(notebook.cells[index - 1].id);
    }
  }, [activeCellId, handleCopyCell, handleDeleteCell, notebook.cells]);

  // Paste cell below active
  const handlePasteCell = useCallback(() => {
    if (!copiedCell) return;
    const newCell = { ...copiedCell, id: `cell-${Date.now()}` };
    setNotebook((prev) => {
      if (!activeCellId) {
        return { ...prev, cells: [...prev.cells, newCell] };
      }
      const index = prev.cells.findIndex((c) => c.id === activeCellId);
      const newCells = [...prev.cells];
      newCells.splice(index + 1, 0, newCell);
      return { ...prev, cells: newCells };
    });
    setActiveCellId(newCell.id);
  }, [copiedCell, activeCellId]);

  // Add cell above active
  const handleAddCellAbove = useCallback((cellType: CellType = 'code') => {
    const newCell = cellType === 'text'
      ? createTextCell(`cell-${Date.now()}`)
      : createCodeCell(`cell-${Date.now()}`);
    setNotebook((prev) => {
      if (!activeCellId) {
        return { ...prev, cells: [newCell, ...prev.cells] };
      }
      const index = prev.cells.findIndex((c) => c.id === activeCellId);
      const newCells = [...prev.cells];
      newCells.splice(index, 0, newCell);
      return { ...prev, cells: newCells };
    });
    setActiveCellId(newCell.id);
  }, [activeCellId]);

  // Jupyter-style keyboard shortcuts
  useEffect(() => {
    let deleteCount = 0;
    let deleteTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Global shortcuts (work in any mode)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleRunAllCells();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        handleOpen();
        return;
      }

      // Alt+V: Toggle variable inspector
      if (e.altKey && e.key === 'v') {
        e.preventDefault();
        setVariableInspectorOpen((prev) => !prev);
        return;
      }

      // Cmd+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Cmd+F: Find
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setFindReplaceOpen(true);
        return;
      }

      // If in input and not command mode, only handle special keys
      if (isInInput && !commandMode) {
        // Shift+Enter: run and advance
        if (e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          if (activeCellId) {
            handleRunCell(activeCellId).then(() => {
              const index = notebook.cells.findIndex((c) => c.id === activeCellId);
              if (index < notebook.cells.length - 1) {
                setActiveCellId(notebook.cells[index + 1].id);
              } else {
                // Add new cell at end
                handleAddCell(activeCellId, 'code');
              }
            });
          }
          return;
        }
        // Ctrl+Enter: run current
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (activeCellId) handleRunCell(activeCellId);
          return;
        }
        // Escape: enter command mode
        if (e.key === 'Escape') {
          e.preventDefault();
          setCommandMode(true);
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        return;
      }

      // Command mode shortcuts (when not in input)
      if (commandMode || !isInInput) {
        // Enter: edit mode
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setCommandMode(false);
          return;
        }

        // Shift+Enter: run and advance
        if (e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          if (activeCellId) {
            handleRunCell(activeCellId).then(() => {
              const index = notebook.cells.findIndex((c) => c.id === activeCellId);
              if (index < notebook.cells.length - 1) {
                setActiveCellId(notebook.cells[index + 1].id);
              }
            });
          }
          return;
        }

        // Ctrl/Cmd+Enter: run current
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (activeCellId) handleRunCell(activeCellId);
          return;
        }

        // A: add cell above
        if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleAddCellAbove('code');
          return;
        }

        // B: add cell below
        if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          if (activeCellId) handleAddCell(activeCellId, 'code');
          return;
        }

        // DD: delete cell (double-d)
        if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          deleteCount++;
          clearTimeout(deleteTimeout);
          if (deleteCount >= 2) {
            deleteCount = 0;
            if (activeCellId) {
              const index = notebook.cells.findIndex((c) => c.id === activeCellId);
              handleDeleteCell(activeCellId);
              if (notebook.cells.length > 1) {
                setActiveCellId(notebook.cells[Math.min(index, notebook.cells.length - 2)]?.id || null);
              }
            }
          } else {
            deleteTimeout = setTimeout(() => { deleteCount = 0; }, 500);
          }
          return;
        }

        // X: cut cell
        if (e.key === 'x' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleCutCell();
          return;
        }

        // C: copy cell
        if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleCopyCell();
          return;
        }

        // V: paste cell
        if (e.key === 'v' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handlePasteCell();
          return;
        }

        // Up/K: select cell above
        if ((e.key === 'ArrowUp' || e.key === 'k') && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          if (activeCellId) {
            const index = notebook.cells.findIndex((c) => c.id === activeCellId);
            if (index > 0) setActiveCellId(notebook.cells[index - 1].id);
          }
          return;
        }

        // Down/J: select cell below
        if ((e.key === 'ArrowDown' || e.key === 'j') && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          if (activeCellId) {
            const index = notebook.cells.findIndex((c) => c.id === activeCellId);
            if (index < notebook.cells.length - 1) setActiveCellId(notebook.cells[index + 1].id);
          }
          return;
        }

        // M: convert to markdown
        if (e.key === 'm' && !e.metaKey && !e.ctrlKey && activeCellId) {
          e.preventDefault();
          handleUpdate(activeCellId, { cellType: 'text' });
          return;
        }

        // Y: convert to code
        if (e.key === 'y' && !e.metaKey && !e.ctrlKey && activeCellId) {
          e.preventDefault();
          handleUpdate(activeCellId, { cellType: 'code' });
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(deleteTimeout);
    };
  }, [activeCellId, commandMode, notebook.cells, handleRunCell, handleAddCell, handleAddCellAbove, handleDeleteCell, handleCopyCell, handleCutCell, handlePasteCell, handleRunAllCells, handleUpdate, canUndo, handleUndo]);

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell || cell.cellType === 'text') return;

      // Determine sync direction based on last edited tab
      // short -> sync to full and code
      // full -> sync to short and code
      // code -> sync to short and full
      const lastEdited = cell.lastEditedTab || 'short';

      // Set syncing state
      handleUpdate(cellId, { isSyncing: true });

      try {
        if (lastEdited === 'code') {
          // Code changed: generate short and full from code
          const codeContent = cell.code?.trim();
          if (!codeContent) {
            handleUpdate(cellId, { isSyncing: false });
            return;
          }

          // Generate short description from code
          const shortResult = await window.promptbook.ai.sync(cellId, 'codeToShort', {
            newContent: codeContent,
            previousContent: cell.lastSyncedCode,
            existingCounterpart: cell.shortDescription,
          });

          // Generate full description from code
          const fullResult = await window.promptbook.ai.sync(cellId, 'codeToFull', {
            newContent: codeContent,
            previousContent: cell.lastSyncedCode,
            existingCounterpart: cell.fullDescription,
          });

          handleUpdate(cellId, {
            shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
            fullDescription: fullResult.success ? fullResult.result || '' : cell.fullDescription,
            lastSyncedCode: codeContent,
            lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
            lastSyncedFull: fullResult.success ? fullResult.result : cell.lastSyncedFull,
            isDirty: false,
            isSyncing: false,
          });
        } else if (lastEdited === 'short') {
          // Short changed: generate full and code from short
          const shortContent = cell.shortDescription?.trim();
          if (!shortContent) {
            handleUpdate(cellId, { isSyncing: false });
            return;
          }

          // Generate code from short
          const codeResult = await window.promptbook.ai.sync(cellId, 'shortToCode', {
            newContent: shortContent,
            previousContent: cell.lastSyncedShort,
            existingCounterpart: cell.code,
          });

          // Generate full from short
          const fullResult = await window.promptbook.ai.sync(cellId, 'shortToFull', {
            newContent: shortContent,
            previousContent: cell.lastSyncedShort,
            existingCounterpart: cell.fullDescription,
          });

          handleUpdate(cellId, {
            code: codeResult.success ? codeResult.result || '' : cell.code,
            fullDescription: fullResult.success ? fullResult.result || '' : cell.fullDescription,
            lastSyncedShort: shortContent,
            lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
            lastSyncedFull: fullResult.success ? fullResult.result : cell.lastSyncedFull,
            isDirty: false,
            isSyncing: false,
          });
        } else {
          // Full changed: generate short and code from full
          const fullContent = cell.fullDescription?.trim();
          if (!fullContent) {
            handleUpdate(cellId, { isSyncing: false });
            return;
          }

          // Generate code from full
          const codeResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
            newContent: fullContent,
            previousContent: cell.lastSyncedFull,
            existingCounterpart: cell.code,
          });

          // Generate short from full
          const shortResult = await window.promptbook.ai.sync(cellId, 'fullToShort', {
            newContent: fullContent,
            previousContent: cell.lastSyncedFull,
            existingCounterpart: cell.shortDescription,
          });

          handleUpdate(cellId, {
            code: codeResult.success ? codeResult.result || '' : cell.code,
            shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
            lastSyncedFull: fullContent,
            lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
            lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
            isDirty: false,
            isSyncing: false,
          });
        }
      } catch (error) {
        handleUpdate(cellId, { isSyncing: false });
        setGlobalError(String(error));
      }
    },
    [notebook.cells, handleUpdate]
  );

  // Run cells above the active cell
  const handleRunAbove = useCallback(async () => {
    if (!activeCellId) return;
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex <= 0) return;
    const cellsAbove = notebook.cells.slice(0, activeIndex).filter((c) => c.cellType === 'code');
    for (const cell of cellsAbove) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, activeCellId, handleRunCell]);

  // Run cells below the active cell (including active)
  const handleRunBelow = useCallback(async () => {
    if (!activeCellId) return;
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex === -1) return;
    const cellsBelow = notebook.cells.slice(activeIndex).filter((c) => c.cellType === 'code');
    for (const cell of cellsBelow) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, activeCellId, handleRunCell]);

  // Clear all outputs
  const handleClearAllOutputs = useCallback(() => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => ({
        ...cell,
        outputs: [],
        lastExecutionTime: undefined,
        lastExecutionSuccess: undefined,
      })),
    }));
  }, []);

  // Handle refresh variables for inspector
  const handleRefreshVariables = useCallback(async (): Promise<Variable[]> => {
    const result = await window.promptbook.kernel.getVariables();
    if (result.success) {
      return result.variables;
    }
    return [];
  }, []);

  const handleOpen = async () => {
    const path = await window.promptbook.file.open();
    if (path) {
      try {
        const loadedNotebook = await window.promptbook.file.read(path);
        setNotebook(loadedNotebook);
        setFilePath(path);
      } catch (error) {
        console.error('Failed to load notebook:', error);
      }
    }
  };

  const handleExportPython = async () => {
    const result = await window.promptbook.file.exportPython(notebook);
    if (result.success && result.filePath) {
      setGlobalError(null); // Clear any existing error
      // Could show a success toast here
    }
  };

  // Find & Replace handlers
  const handleSearch = useCallback((query: string, caseSensitive: boolean, useRegex: boolean): SearchMatch[] => {
    const matches: SearchMatch[] = [];
    const flags = caseSensitive ? 'g' : 'gi';

    const searchIn = (text: string, field: SearchMatch['field'], cellId: string) => {
      if (!text) return;

      let regex: RegExp;
      try {
        regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch {
        return; // Invalid regex
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          cellId,
          field,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0],
        });
      }
    };

    for (const cell of notebook.cells) {
      if (cell.cellType === 'code') {
        searchIn(cell.shortDescription, 'shortDescription', cell.id);
        searchIn(cell.fullDescription, 'fullDescription', cell.id);
        searchIn(cell.code, 'code', cell.id);
      } else {
        searchIn(cell.textContent, 'textContent', cell.id);
      }
    }

    return matches;
  }, [notebook.cells]);

  const handleReplace = useCallback((match: SearchMatch, replacement: string) => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => {
        if (cell.id !== match.cellId) return cell;

        const field = match.field;
        const text = cell[field] as string;
        if (!text) return cell;

        const newText = text.slice(0, match.startIndex) + replacement + text.slice(match.endIndex);
        return { ...cell, [field]: newText };
      }),
    }));
  }, []);

  const handleReplaceAll = useCallback((query: string, replacement: string, caseSensitive: boolean, useRegex: boolean): number => {
    let count = 0;
    const flags = caseSensitive ? 'g' : 'gi';

    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => {
        let regex: RegExp;
        try {
          regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch {
          return cell;
        }

        const newCell = { ...cell };
        const fields: Array<keyof CellState> = cell.cellType === 'code'
          ? ['shortDescription', 'fullDescription', 'code']
          : ['textContent'];

        for (const field of fields) {
          const text = cell[field] as string;
          if (!text) continue;

          const newText = text.replace(regex, () => {
            count++;
            return replacement;
          });
          (newCell as Record<string, unknown>)[field] = newText;
        }

        return newCell;
      }),
    }));

    return count;
  }, []);

  const handleSave = async () => {
    if (filePath) {
      await window.promptbook.file.save(filePath, notebook);
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
    } else {
      const result = await window.promptbook.file.saveAs(notebook);
      if (result.success && result.filePath) {
        setFilePath(result.filePath);
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
      }
    }
  };

  const fileName = filePath ? filePath.split('/').pop() : null;

  return (
    <div className={`app ${variableInspectorOpen ? 'app--inspector-open' : ''}`}>
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">{Icons.logo}</span>
          <h1>Promptbook</h1>
          {fileName && (
            <span className="app-filename">
              {fileName}
              {hasUnsavedChanges && <span className="app-filename__unsaved" title="Unsaved changes">●</span>}
            </span>
          )}
        </div>
        <div className="app-actions">
          <KernelStatus
            status={kernelState}
            environment={selectedEnvironment}
            onClick={() => setEnvironmentPickerOpen(true)}
            onInterrupt={handleInterrupt}
            onRestart={handleRestart}
          />
          <div className="toolbar-group">
            <button onClick={handleRunAllCells} title="Run All Cells (⇧⌘↵)" className="toolbar-btn toolbar-btn--primary">
              {Icons.runAll}
              <span>Run All</span>
            </button>
            <div className="toolbar-dropdown">
              <button className="toolbar-dropdown-trigger" title="More run options">
                {Icons.chevronDown}
              </button>
              <div className="toolbar-dropdown-menu">
                <button onClick={handleRunAbove}>Run Above</button>
                <button onClick={handleRunBelow}>Run Below</button>
                <hr />
                <button onClick={handleClearAllOutputs}>Clear All Outputs</button>
                <hr />
                <button onClick={handleExportPython}>Export to Python</button>
              </div>
            </div>
          </div>
          <button onClick={handleUndo} disabled={!canUndo} title="Undo (⌘Z)">
            {Icons.undo}
          </button>
          <button onClick={handleOpen} title="Open file (⌘O)">
            {Icons.folder}
            <span>Open</span>
          </button>
          <button onClick={handleSave} title="Save file (⌘S)">
            {Icons.save}
            <span>Save</span>
          </button>
          <button
            onClick={() => setVariableInspectorOpen(!variableInspectorOpen)}
            title="Variables (⌥V)"
            className={variableInspectorOpen ? 'toolbar-btn--active' : ''}
          >
            {Icons.variables}
            <span>Variables</span>
          </button>
          <button onClick={() => setSettingsOpen(true)} title="Settings">
            {Icons.settings}
          </button>
        </div>
      </header>
      <main className="app-main">
        <Notebook
          notebook={notebook}
          onUpdate={handleUpdate}
          onRunCell={handleRunCell}
          onSyncCell={handleSyncCell}
          onAddCell={handleAddCell}
          onDeleteCell={handleDeleteCell}
          onMoveCell={handleMoveCell}
          activeCellId={activeCellId || undefined}
          onCellFocus={setActiveCellId}
        />
      </main>
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
      <EnvironmentPicker
        isOpen={environmentPickerOpen}
        onClose={() => {
          setEnvironmentPickerOpen(false);
          setInstallError(null);
        }}
        environments={environments}
        selectedEnvironment={selectedEnvironment}
        onSelect={handleSelectEnvironment}
        onRefresh={handleRefreshEnvironments}
        onCreateVenv={handleCreateVenv}
        isInstalling={isInstallingIpykernel}
        isCreatingVenv={isCreatingVenv}
        installError={installError}
      />
      {globalError && (
        <div className="error-toast">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)} title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      )}
      <VariableInspector
        isOpen={variableInspectorOpen}
        onClose={() => setVariableInspectorOpen(false)}
        onRefresh={handleRefreshVariables}
      />
      <FindReplace
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        onSearch={handleSearch}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
        onNavigate={(cellId) => setActiveCellId(cellId)}
      />
    </div>
  );
}
