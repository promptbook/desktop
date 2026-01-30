import React, { useState, useCallback, useEffect } from 'react';
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
    };
  }
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

      // If cell is dirty, sync with AI first
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
            handleUpdate(cellId, {
              code: generatedCode,
              lastSyncedCode: generatedCode,
              isDirty: false,
              isSyncing: false,
            });
            cell = { ...cell, code: generatedCode };
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
            handleUpdate(cellId, {
              code: generatedCode,
              lastSyncedCode: generatedCode,
              isDirty: false,
              isSyncing: false,
            });
            cell = { ...cell, code: generatedCode };
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
      handleUpdate(cellId, { isExecuting: true, outputs: [] });

      try {
        const result = await window.promptbook.kernel.execute(cell.code);

        if (result.needsEnvironment) {
          handleUpdate(cellId, { isExecuting: false });
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
          });
        } else {
          handleUpdate(cellId, {
            isExecuting: false,
            outputs: [{ type: 'error', content: result.error || 'Execution failed' }],
          });
        }
      } catch (error) {
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: [{ type: 'error', content: String(error) }],
        });
      }
    },
    [notebook.cells, handleUpdate]
  );

  // Keyboard shortcuts (Cmd+R to run active cell)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+R (Mac) or Ctrl+R (Windows/Linux) to run active cell
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        if (activeCellId) {
          handleRunCell(activeCellId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCellId, handleRunCell]);

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

  const handleSave = async () => {
    if (filePath) {
      await window.promptbook.file.save(filePath, notebook);
    } else {
      const result = await window.promptbook.file.saveAs(notebook);
      if (result.success && result.filePath) {
        setFilePath(result.filePath);
      }
    }
  };

  const fileName = filePath ? filePath.split('/').pop() : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">{Icons.logo}</span>
          <h1>Promptbook</h1>
          {fileName && <span className="app-filename">{fileName}</span>}
        </div>
        <div className="app-actions">
          <KernelStatus
            status={kernelState}
            environment={selectedEnvironment}
            onClick={() => setEnvironmentPickerOpen(true)}
            onInterrupt={handleInterrupt}
            onRestart={handleRestart}
          />
          <button onClick={handleOpen} title="Open file (⌘O)">
            {Icons.folder}
            <span>Open</span>
          </button>
          <button onClick={handleSave} title="Save file (⌘S)">
            {Icons.save}
            <span>Save</span>
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
    </div>
  );
}
