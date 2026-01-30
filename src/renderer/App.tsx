import React, { useState, useCallback, useEffect } from 'react';
import {
  Notebook,
  NotebookState,
  CellState,
  CellOutput,
  createEmptyNotebook,
  createEmptyCell,
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
        sync: (cellId: string, direction: string, content: string) => Promise<{ success: boolean; result?: string; error?: string }>;
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
  sparkles: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5l1.5 4.5L15 7.5l-4.5 1.5L9 13.5 7.5 9 3 7.5l4.5-1.5L9 1.5z" fill="currentColor" opacity="0.8" />
      <path d="M14 12l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L12 14l1.5-.5.5-1.5z" fill="currentColor" opacity="0.6" />
      <path d="M4 2l.375 1.125L5.5 3.5l-1.125.375L4 5l-.375-1.125L2.5 3.5l1.125-.375L4 2z" fill="currentColor" opacity="0.5" />
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

  // Load settings and environments on mount
  useEffect(() => {
    window.promptbook.settings.load().then(setSettings);
    window.promptbook.kernel.scanEnvironments().then(setEnvironments);
    window.promptbook.kernel.getStatus().then(({ state }) => setKernelState(state));
  }, []);

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
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell) return;

      // Check if we have a kernel
      const status = await window.promptbook.kernel.getStatus();
      if (status.state === 'disconnected' || status.state === 'dead') {
        // Need to select an environment first
        setEnvironmentPickerOpen(true);
        return;
      }

      handleUpdate(cellId, { isExecuting: true, outputs: [] });

      try {
        const result = await window.promptbook.kernel.execute(cell.code);

        if (result.needsEnvironment) {
          handleUpdate(cellId, { isExecuting: false });
          setEnvironmentPickerOpen(true);
          return;
        }

        if (result.success && result.outputs) {
          // Convert kernel outputs to cell outputs
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

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell) return;

      const direction =
        cell.lastEditedTab === 'instructions' ? 'toCode' : 'toInstructions';

      // Get content based on direction
      const content = direction === 'toCode'
        ? (cell.instructions?.text || '')
        : cell.code;

      if (!content.trim()) {
        setGlobalError('No content to sync');
        return;
      }

      // Check cache: skip AI call if content hasn't changed since last sync
      if (direction === 'toCode' && cell.lastSyncedInstructions === content.trim()) {
        // Content hasn't changed, no need to call AI again
        handleUpdate(cellId, { isDirty: false });
        return;
      }

      // Set syncing state to show progress overlay
      handleUpdate(cellId, { isSyncing: true });

      try {
        const result = await window.promptbook.ai.sync(cellId, direction, content);

        if (result.success && result.result) {
          if (direction === 'toCode') {
            handleUpdate(cellId, {
              code: result.result,
              isDirty: false,
              isSyncing: false,
              lastSyncedInstructions: content.trim(), // Cache the synced instructions
            });
          } else {
            handleUpdate(cellId, {
              instructions: { text: result.result, parameters: cell.instructions?.parameters || [] },
              isDirty: false,
              isSyncing: false,
            });
          }
        } else {
          handleUpdate(cellId, { isSyncing: false });
          if (result.error) {
            setGlobalError(result.error);
          }
        }
      } catch (error) {
        handleUpdate(cellId, { isSyncing: false });
        setGlobalError(String(error));
      }
    },
    [notebook.cells, handleUpdate]
  );

  const handleAddCell = useCallback((afterCellId?: string) => {
    const newCell = createEmptyCell(`cell-${Date.now()}`);
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
          <span className="app-logo">{Icons.sparkles}</span>
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
