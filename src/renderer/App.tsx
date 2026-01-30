import React, { useState, useCallback } from 'react';
import {
  Notebook,
  NotebookState,
  KernelStatus,
  EnvironmentPicker,
  VariableInspector,
  Variable,
  FindReplace,
  PackageInstallModal,
  KernelSymbol,
} from '@promptbook/core/ui';
import { Settings, AppSettings, defaultSettings } from './Settings';
import { Icons } from './icons';
import './types'; // Import global type declarations

import {
  useKernel,
  useNotebook,
  useAutoSave,
  useFindReplace,
  useKeyboardShortcuts,
} from './hooks';

// Props for integration with project management (Electron only)
interface AppProps {
  projectId?: string;
  filePath?: string;
  onOpenSettings?: () => void;
}

export function App({ projectId, filePath: initialFilePath, onOpenSettings: _onOpenSettings }: AppProps = {}) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [variableInspectorOpen, setVariableInspectorOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Kernel hook
  const kernel = useKernel((error) => setGlobalError(error));

  // Version control
  const handleSaveVersion = useCallback(async (message: string) => {
    const content = JSON.stringify(notebookHook.notebook, null, 2);
    await window.promptbook.version.save(notebookId, content, message);
    const canUndoResult = await window.promptbook.version.canUndo(notebookId);
    setCanUndo(canUndoResult.canUndo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notebook hook
  const notebookHook = useNotebook(
    initialFilePath || null,
    projectId,
    (error) => setGlobalError(error),
    kernel.setEnvironmentPickerOpen,
    handleSaveVersion
  );

  // Auto-save hook
  const autoSave = useAutoSave(notebookHook.notebook, notebookHook.filePath);

  // Find & Replace hook
  const findReplace = useFindReplace(notebookHook.notebook, notebookHook.setNotebook);

  // Compute notebookId for version control
  const notebookId = notebookHook.filePath
    ? notebookHook.filePath.replace(/[^a-zA-Z0-9]/g, '_')
    : `untitled_${Date.now()}`;

  // Load settings on mount
  React.useEffect(() => {
    window.promptbook.settings.load().then(setSettings);
  }, []);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await window.promptbook.settings.save(newSettings);
    setSettings(newSettings);
  };

  const handleOpen = async () => {
    const path = await window.promptbook.file.open();
    if (path) {
      try {
        const loadedNotebook = await window.promptbook.file.read(path);
        notebookHook.setNotebook(loadedNotebook);
        notebookHook.setFilePath(path);
      } catch (error) {
        console.error('Failed to load notebook:', error);
      }
    }
  };

  const handleSave = async () => {
    if (notebookHook.filePath) {
      await window.promptbook.file.save(notebookHook.filePath, notebookHook.notebook);
      autoSave.setHasUnsavedChanges(false);
      autoSave.setLastSavedAt(new Date());
    } else {
      const result = await window.promptbook.file.saveAs(notebookHook.notebook);
      if (result.success && result.filePath) {
        notebookHook.setFilePath(result.filePath);
        autoSave.setHasUnsavedChanges(false);
        autoSave.setLastSavedAt(new Date());
      }
    }
  };

  const handleExportPython = async () => {
    const result = await window.promptbook.file.exportPython(notebookHook.notebook);
    if (result.success && result.filePath) {
      setGlobalError(null);
    }
  };

  // Undo to previous version
  const handleUndo = useCallback(async () => {
    const result = await window.promptbook.version.undo(notebookId);
    if (result.success && result.content) {
      try {
        const restored = JSON.parse(result.content) as NotebookState;
        notebookHook.setNotebook(restored);
        const canUndoResult = await window.promptbook.version.canUndo(notebookId);
        setCanUndo(canUndoResult.canUndo);
      } catch {
        setGlobalError('Failed to restore version');
      }
    }
  }, [notebookId, notebookHook]);

  // Refresh variables for inspector
  const handleRefreshVariables = useCallback(async (): Promise<Variable[]> => {
    const result = await window.promptbook.kernel.getVariables();
    return result.success ? result.variables : [];
  }, []);

  // Get kernel symbols for # autocomplete
  const handleGetSymbols = useCallback(async (): Promise<KernelSymbol[]> => {
    const result = await window.promptbook.kernel.getSymbols();
    return result.success ? result.symbols : [];
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    notebook: notebookHook.notebook,
    activeCellId: notebookHook.activeCellId,
    commandMode: notebookHook.commandMode,
    canUndo,
    setCommandMode: notebookHook.setCommandMode,
    setActiveCellId: notebookHook.setActiveCellId,
    setVariableInspectorOpen,
    setFindReplaceOpen: findReplace.setFindReplaceOpen,
    handleRunCell: notebookHook.handleRunCell,
    handleRunAllCells: notebookHook.handleRunAllCells,
    handleAddCell: notebookHook.handleAddCell,
    handleAddCellAbove: notebookHook.handleAddCellAbove,
    handleDeleteCell: notebookHook.handleDeleteCell,
    handleCopyCell: notebookHook.handleCopyCell,
    handleCutCell: notebookHook.handleCutCell,
    handlePasteCell: notebookHook.handlePasteCell,
    handleUpdate: notebookHook.handleUpdate,
    handleUndo,
    handleSave,
    handleOpen,
  });

  const fileName = notebookHook.filePath ? notebookHook.filePath.split('/').pop() : null;

  return (
    <div className={`app ${variableInspectorOpen ? 'app--inspector-open' : ''}`}>
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">{Icons.logo}</span>
          <h1>Promptbook</h1>
          {fileName && (
            <span className="app-filename">
              {fileName}
              {autoSave.hasUnsavedChanges && <span className="app-filename__unsaved" title="Unsaved changes">●</span>}
            </span>
          )}
        </div>
        <div className="app-actions">
          <KernelStatus
            status={kernel.kernelState}
            environment={kernel.selectedEnvironment}
            onClick={() => kernel.setEnvironmentPickerOpen(true)}
            onInterrupt={kernel.handleInterrupt}
            onRestart={kernel.handleRestart}
          />
          <div className="toolbar-group">
            <button onClick={notebookHook.handleRunAllCells} title="Run All Cells (⇧⌘↵)" className="toolbar-btn toolbar-btn--primary">
              {Icons.runAll}
              <span>Run All</span>
            </button>
            <div className="toolbar-dropdown">
              <button className="toolbar-dropdown-trigger" title="More run options">
                {Icons.chevronDown}
              </button>
              <div className="toolbar-dropdown-menu">
                <button onClick={notebookHook.handleRunAbove}>Run Above</button>
                <button onClick={notebookHook.handleRunBelow}>Run Below</button>
                <hr />
                <button onClick={notebookHook.handleClearAllOutputs}>Clear All Outputs</button>
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
          notebook={notebookHook.notebook}
          onUpdate={notebookHook.handleUpdate}
          onRunCell={notebookHook.handleRunCell}
          onSyncCell={notebookHook.handleSyncCell}
          onAddCell={notebookHook.handleAddCell}
          onDeleteCell={notebookHook.handleDeleteCell}
          onMoveCell={notebookHook.handleMoveCell}
          activeCellId={notebookHook.activeCellId || undefined}
          onCellFocus={notebookHook.setActiveCellId}
          listFiles={notebookHook.listFiles}
          getSymbols={handleGetSymbols}
        />
      </main>
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
      <EnvironmentPicker
        isOpen={kernel.environmentPickerOpen}
        onClose={() => {
          kernel.setEnvironmentPickerOpen(false);
          kernel.setInstallError(null);
        }}
        environments={kernel.environments}
        selectedEnvironment={kernel.selectedEnvironment}
        onSelect={kernel.handleSelectEnvironment}
        onRefresh={kernel.handleRefreshEnvironments}
        onCreateVenv={kernel.handleCreateVenv}
        isInstalling={kernel.isInstallingIpykernel}
        isCreatingVenv={kernel.isCreatingVenv}
        installError={kernel.installError}
      />
      <PackageInstallModal
        isOpen={notebookHook.packageInstallModal.isOpen}
        onClose={() => {
          notebookHook.setPackageInstallModal({ isOpen: false, packages: [], cellId: '' });
          notebookHook.setPackageInstallError(null);
        }}
        packages={notebookHook.packageInstallModal.packages}
        onInstall={notebookHook.handleInstallPackages}
        isInstalling={notebookHook.isInstallingPackages}
        installError={notebookHook.packageInstallError}
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
        isOpen={findReplace.findReplaceOpen}
        onClose={() => findReplace.setFindReplaceOpen(false)}
        onSearch={findReplace.handleSearch}
        onReplace={findReplace.handleReplace}
        onReplaceAll={findReplace.handleReplaceAll}
        onNavigate={(cellId) => notebookHook.setActiveCellId(cellId)}
      />
    </div>
  );
}
