import React, { useState, useCallback, useMemo } from 'react';
import {
  Notebook,
  KernelStatus,
  EnvironmentPicker,
  VariableInspector,
  Variable,
  FindReplace,
  PackageInstallModal,
  PackageInspector,
  KernelSymbol,
  PythonEnvironment,
  DataFrameCallbacks,
} from '@promptbook/core';
import type { InstalledPackage } from '@promptbook/core';
import type { DataFrameMetadata, DataFramePagination } from '@promptbook/core';
import { Settings, AppSettings } from './Settings';
import { Icons } from './icons';
import './types'; // Import global type declarations

import {
  useKernel,
  useNotebook,
  useAutoSave,
  useFindReplace,
  useKeyboardShortcuts,
  useTheme,
  useFileOperations,
  useVersionControl,
  useSettings,
} from './hooks';
import { useAIAssistance } from './hooks/useAIAssistance';

// Props for integration with project management (Electron only)
interface AppProps {
  projectId?: string;
  filePath?: string;
  onOpenSettings?: () => void;
}

// Props for AppHeader component
interface AppHeaderProps {
  fileName: string | null;
  hasUnsavedChanges: boolean;
  themeClass: string;
  kernelState: string;
  selectedEnvironment: PythonEnvironment | null;
  canUndo: boolean;
  variableInspectorOpen: boolean;
  packageInspectorOpen: boolean;
  onEnvironmentClick: () => void;
  onInterrupt: () => void;
  onRestart: () => void;
  onRunAll: () => void;
  onRunAbove: () => void;
  onRunBelow: () => void;
  onClearAllOutputs: () => void;
  onExportPython: () => void;
  onUndo: () => void;
  onOpen: () => void;
  onSave: () => void;
  onVariableInspectorToggle: () => void;
  onPackageInspectorToggle: () => void;
  onThemeToggle: () => void;
  onSettingsOpen: () => void;
  getThemeIcon: () => React.ReactNode;
  getThemeLabel: () => string;
}

// AppHeader component - extracted from App
function AppHeader({
  fileName,
  hasUnsavedChanges,
  kernelState,
  selectedEnvironment,
  canUndo,
  variableInspectorOpen,
  packageInspectorOpen,
  onEnvironmentClick,
  onInterrupt,
  onRestart,
  onRunAll,
  onRunAbove,
  onRunBelow,
  onClearAllOutputs,
  onExportPython,
  onUndo,
  onOpen,
  onSave,
  onVariableInspectorToggle,
  onPackageInspectorToggle,
  onThemeToggle,
  onSettingsOpen,
  getThemeIcon,
  getThemeLabel,
}: AppHeaderProps) {
  return (
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
          onClick={onEnvironmentClick}
          onInterrupt={onInterrupt}
          onRestart={onRestart}
        />
        <div className="toolbar-group">
          <button onClick={onRunAll} title="Run All Cells (⇧⌘↵)" className="toolbar-btn toolbar-btn--primary">
            {Icons.runAll}
            <span>Run All</span>
          </button>
          <div className="toolbar-dropdown">
            <button className="toolbar-dropdown-trigger" title="More run options">
              {Icons.chevronDown}
            </button>
            <div className="toolbar-dropdown-menu">
              <button onClick={onRunAbove}>Run Above</button>
              <button onClick={onRunBelow}>Run Below</button>
              <hr />
              <button onClick={onClearAllOutputs}>Clear All Outputs</button>
              <hr />
              <button onClick={onExportPython}>Export to Python</button>
            </div>
          </div>
        </div>
        <button onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          {Icons.undo}
        </button>
        <button onClick={onOpen} title="Open file (⌘O)">
          {Icons.folder}
          <span>Open</span>
        </button>
        <button onClick={onSave} title="Save file (⌘S)">
          {Icons.save}
          <span>Save</span>
        </button>
        <button
          onClick={onVariableInspectorToggle}
          title="Variables (⌥V)"
          className={variableInspectorOpen ? 'toolbar-btn--active' : ''}
        >
          {Icons.variables}
          <span>Variables</span>
        </button>
        <button
          onClick={onPackageInspectorToggle}
          title="Packages (⌥P)"
          className={packageInspectorOpen ? 'toolbar-btn--active' : ''}
        >
          {Icons.package}
          <span>Packages</span>
        </button>
        <button
          onClick={onThemeToggle}
          title={`Theme: ${getThemeLabel()} (click to change)`}
          className="toolbar-btn--theme"
        >
          {getThemeIcon()}
        </button>
        <button onClick={onSettingsOpen} title="Settings">
          {Icons.settings}
        </button>
      </div>
    </header>
  );
}

// Props for AppModals component
interface AppModalsProps {
  settingsOpen: boolean;
  onSettingsClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  environmentPickerOpen: boolean;
  onEnvironmentPickerClose: () => void;
  environments: PythonEnvironment[];
  selectedEnvironment: PythonEnvironment | null;
  onSelectEnvironment: (env: PythonEnvironment) => void;
  onRefreshEnvironments: () => void;
  onCreateVenv: (name: string, pythonPath?: string) => Promise<void>;
  isInstallingIpykernel: boolean;
  isCreatingVenv: boolean;
  installError: string | null;
  packageInstallModal: { isOpen: boolean; packages: string[]; cellId: string };
  onPackageInstallClose: () => void;
  onInstallPackages: (packages: string[]) => Promise<void>;
  isInstallingPackages: boolean;
  packageInstallError: string | null;
  globalError: string | null;
  onDismissError: () => void;
  variableInspectorOpen: boolean;
  onVariableInspectorClose: () => void;
  onRefreshVariables: () => Promise<Variable[]>;
  packageInspectorOpen: boolean;
  onPackageInspectorClose: () => void;
  onRefreshPackages: () => Promise<InstalledPackage[]>;
  onInstallPackage: (packageName: string) => Promise<{ success: boolean; error?: string }>;
  onUninstallPackage: (packageName: string) => Promise<{ success: boolean; error?: string }>;
  findReplaceOpen: boolean;
  onFindReplaceClose: () => void;
  onSearch: (query: string, options: { caseSensitive: boolean; regex: boolean }) => {
    cellId: string;
    matches: { start: number; end: number }[];
  }[];
  onReplace: (cellId: string, matchIndex: number, replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onNavigate: (cellId: string) => void;
}

// Props for NotebookContent component
interface NotebookContentProps {
  notebookHook: ReturnType<typeof useNotebook>;
  getSymbols: () => Promise<KernelSymbol[]>;
  aiAssistance: ReturnType<typeof useAIAssistance>;
  dataframeCallbacks: DataFrameCallbacks;
}

// NotebookContent component - main notebook area
function NotebookContent({ notebookHook, getSymbols, aiAssistance, dataframeCallbacks }: NotebookContentProps) {
  // Transform aiAssistance props to match the expected interface
  const aiAssistanceProps = {
    messages: aiAssistance.messages,
    isLoading: aiAssistance.isLoading,
    onSendMessage: aiAssistance.sendMessage,
    clearHistory: aiAssistance.clearHistory,
  };

  return (
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
        getSymbols={getSymbols}
        preloadedSymbols={notebookHook.notebookSymbols}
        aiAssistance={aiAssistanceProps}
        dataframeCallbacks={dataframeCallbacks}
      />
    </main>
  );
}

// AppModals component - extracted from App
function AppModals({
  settingsOpen,
  onSettingsClose,
  settings,
  onSaveSettings,
  environmentPickerOpen,
  onEnvironmentPickerClose,
  environments,
  selectedEnvironment,
  onSelectEnvironment,
  onRefreshEnvironments,
  onCreateVenv,
  isInstallingIpykernel,
  isCreatingVenv,
  installError,
  packageInstallModal,
  onPackageInstallClose,
  onInstallPackages,
  isInstallingPackages,
  packageInstallError,
  globalError,
  onDismissError,
  variableInspectorOpen,
  onVariableInspectorClose,
  onRefreshVariables,
  packageInspectorOpen,
  onPackageInspectorClose,
  onRefreshPackages,
  onInstallPackage,
  onUninstallPackage,
  findReplaceOpen,
  onFindReplaceClose,
  onSearch,
  onReplace,
  onReplaceAll,
  onNavigate,
}: AppModalsProps) {
  return (
    <>
      <Settings
        isOpen={settingsOpen}
        onClose={onSettingsClose}
        settings={settings}
        onSave={onSaveSettings}
      />
      <EnvironmentPicker
        isOpen={environmentPickerOpen}
        onClose={onEnvironmentPickerClose}
        environments={environments}
        selectedEnvironment={selectedEnvironment}
        onSelect={onSelectEnvironment}
        onRefresh={onRefreshEnvironments}
        onCreateVenv={onCreateVenv}
        isInstalling={isInstallingIpykernel}
        isCreatingVenv={isCreatingVenv}
        installError={installError}
      />
      <PackageInstallModal
        isOpen={packageInstallModal.isOpen}
        onClose={onPackageInstallClose}
        packages={packageInstallModal.packages}
        onInstall={onInstallPackages}
        isInstalling={isInstallingPackages}
        installError={packageInstallError}
      />
      {globalError && (
        <div className="error-toast">
          <span>{globalError}</span>
          <button onClick={onDismissError} title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      )}
      <VariableInspector
        isOpen={variableInspectorOpen}
        onClose={onVariableInspectorClose}
        onRefresh={onRefreshVariables}
      />
      <PackageInspector
        isOpen={packageInspectorOpen}
        onClose={onPackageInspectorClose}
        onRefresh={onRefreshPackages}
        onInstall={onInstallPackage}
        onUninstall={onUninstallPackage}
      />
      <FindReplace
        isOpen={findReplaceOpen}
        onClose={onFindReplaceClose}
        onSearch={onSearch}
        onReplace={onReplace}
        onReplaceAll={onReplaceAll}
        onNavigate={onNavigate}
      />
    </>
  );
}

export function App({ projectId, filePath: initialFilePath, onOpenSettings: _onOpenSettings }: AppProps = {}) {
  // Settings hook
  const settingsHook = useSettings();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [variableInspectorOpen, setVariableInspectorOpen] = useState(false);
  const [packageInspectorOpen, setPackageInspectorOpen] = useState(false);

  // Theme hook
  const theme = useTheme(settingsHook.settings, settingsHook.setSettings);

  // Kernel hook
  const kernel = useKernel((error) => setGlobalError(error));

  // Notebook hook
  const notebookHook = useNotebook(
    initialFilePath || null, projectId, (error) => setGlobalError(error),
    kernel.setEnvironmentPickerOpen, async () => {}, settingsHook.settings.editor?.defaultTab || 'short'
  );

  // Version control, auto-save, file operations, find & replace hooks
  const versionControl = useVersionControl(notebookHook, setGlobalError);
  const autoSave = useAutoSave(notebookHook.notebook, notebookHook.filePath, projectId);
  const fileOps = useFileOperations(notebookHook, autoSave, setGlobalError);
  const findReplace = useFindReplace(notebookHook.notebook, notebookHook.setNotebook);

  // AI Assistance hook
  const aiAssistance = useAIAssistance();

  // Callbacks for kernel operations
  const handleRefreshVariables = useCallback(async (): Promise<Variable[]> => {
    const result = await window.promptbook.kernel.getVariables();
    return result.success ? result.variables : [];
  }, []);

  const handleGetSymbols = useCallback(async (): Promise<KernelSymbol[]> => {
    const result = await window.promptbook.kernel.getSymbols();
    return result.success ? result.symbols : [];
  }, []);

  // Package management callbacks
  const handleRefreshPackages = useCallback(async (): Promise<InstalledPackage[]> => {
    const result = await window.promptbook.kernel.listPackages();
    return result.success ? result.packages : [];
  }, []);

  const handleInstallPackage = useCallback(async (packageName: string) => {
    return await window.promptbook.kernel.installPackage(packageName);
  }, []);

  const handleUninstallPackage = useCallback(async (packageName: string) => {
    return await window.promptbook.kernel.uninstallPackage(packageName);
  }, []);

  // DataFrame callbacks for interactive DataFrame rendering
  const dataframeCallbacks: DataFrameCallbacks = useMemo(() => ({
    onGetPage: async (dfId: string, page: number, pageSize: number) => {
      const result = await window.promptbook.dataframe.getPage(dfId, page, pageSize);
      if (result.success && result.data) {
        return result.data as { data: Record<string, unknown>[]; pagination: DataFramePagination };
      }
      return null;
    },
    onEditCell: async (dfId: string, rowIndex: number, column: string, value: unknown) => {
      const result = await window.promptbook.dataframe.editCell(dfId, rowIndex, column, value);
      return result.success;
    },
    onAddRow: async (dfId: string) => {
      const result = await window.promptbook.dataframe.addRow(dfId);
      return result.success && result.data ? (result.data as { metadata: DataFrameMetadata }).metadata : null;
    },
    onDeleteRow: async (dfId: string, rowIndex: number) => {
      const result = await window.promptbook.dataframe.deleteRow(dfId, rowIndex);
      return result.success && result.data ? (result.data as { metadata: DataFrameMetadata }).metadata : null;
    },
    onAddColumn: async (dfId: string, name: string, dtype) => {
      const result = await window.promptbook.dataframe.addColumn(dfId, name, dtype);
      return result.success && result.data ? (result.data as { metadata: DataFrameMetadata }).metadata : null;
    },
    onDeleteColumn: async (dfId: string, column: string) => {
      const result = await window.promptbook.dataframe.deleteColumn(dfId, column);
      return result.success && result.data ? (result.data as { metadata: DataFrameMetadata }).metadata : null;
    },
  }), []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    notebook: notebookHook.notebook, activeCellId: notebookHook.activeCellId, commandMode: notebookHook.commandMode,
    canUndo: versionControl.canUndo, setCommandMode: notebookHook.setCommandMode, setActiveCellId: notebookHook.setActiveCellId,
    setVariableInspectorOpen, setFindReplaceOpen: findReplace.setFindReplaceOpen,
    handleRunCell: notebookHook.handleRunCell, handleRunAllCells: notebookHook.handleRunAllCells,
    handleAddCell: notebookHook.handleAddCell, handleAddCellAbove: notebookHook.handleAddCellAbove,
    handleDeleteCell: notebookHook.handleDeleteCell, handleCopyCell: notebookHook.handleCopyCell,
    handleCutCell: notebookHook.handleCutCell, handlePasteCell: notebookHook.handlePasteCell,
    handleUpdate: notebookHook.handleUpdate, handleUndo: versionControl.handleUndo,
    handleSave: fileOps.handleSave, handleOpen: fileOps.handleOpen,
  });

  const fileName = notebookHook.filePath ? notebookHook.filePath.split('/').pop() || null : null;

  // Modal close handlers
  const handleEnvironmentPickerClose = useCallback(() => {
    kernel.setEnvironmentPickerOpen(false);
    kernel.setInstallError(null);
  }, [kernel]);

  const handlePackageInstallClose = useCallback(() => {
    notebookHook.setPackageInstallModal({ isOpen: false, packages: [], cellId: '' });
    notebookHook.setPackageInstallError(null);
  }, [notebookHook]);

  return (
    <div className={`app ${theme.themeClass} ${variableInspectorOpen ? 'app--inspector-open' : ''} ${packageInspectorOpen ? 'app--packages-open' : ''}`}>
      <AppHeader
        fileName={fileName} hasUnsavedChanges={autoSave.hasUnsavedChanges} themeClass={theme.themeClass}
        kernelState={kernel.kernelState} selectedEnvironment={kernel.selectedEnvironment}
        canUndo={versionControl.canUndo} variableInspectorOpen={variableInspectorOpen}
        packageInspectorOpen={packageInspectorOpen}
        onEnvironmentClick={() => kernel.setEnvironmentPickerOpen(true)}
        onInterrupt={kernel.handleInterrupt} onRestart={kernel.handleRestart}
        onRunAll={notebookHook.handleRunAllCells} onRunAbove={notebookHook.handleRunAbove}
        onRunBelow={notebookHook.handleRunBelow} onClearAllOutputs={notebookHook.handleClearAllOutputs}
        onExportPython={fileOps.handleExportPython} onUndo={versionControl.handleUndo}
        onOpen={fileOps.handleOpen} onSave={fileOps.handleSave}
        onVariableInspectorToggle={() => setVariableInspectorOpen(!variableInspectorOpen)}
        onPackageInspectorToggle={() => setPackageInspectorOpen(!packageInspectorOpen)}
        onThemeToggle={theme.handleThemeToggle} onSettingsOpen={() => settingsHook.setSettingsOpen(true)}
        getThemeIcon={theme.getThemeIcon} getThemeLabel={theme.getThemeLabel}
      />
      <NotebookContent notebookHook={notebookHook} getSymbols={handleGetSymbols} aiAssistance={aiAssistance} dataframeCallbacks={dataframeCallbacks} />
      <AppModals
        settingsOpen={settingsHook.settingsOpen} onSettingsClose={() => settingsHook.setSettingsOpen(false)}
        settings={settingsHook.settings} onSaveSettings={settingsHook.handleSaveSettings}
        environmentPickerOpen={kernel.environmentPickerOpen} onEnvironmentPickerClose={handleEnvironmentPickerClose}
        environments={kernel.environments} selectedEnvironment={kernel.selectedEnvironment}
        onSelectEnvironment={kernel.handleSelectEnvironment} onRefreshEnvironments={kernel.handleRefreshEnvironments}
        onCreateVenv={kernel.handleCreateVenv} isInstallingIpykernel={kernel.isInstallingIpykernel}
        isCreatingVenv={kernel.isCreatingVenv} installError={kernel.installError}
        packageInstallModal={notebookHook.packageInstallModal} onPackageInstallClose={handlePackageInstallClose}
        onInstallPackages={notebookHook.handleInstallPackages} isInstallingPackages={notebookHook.isInstallingPackages}
        packageInstallError={notebookHook.packageInstallError} globalError={globalError}
        onDismissError={() => setGlobalError(null)} variableInspectorOpen={variableInspectorOpen}
        onVariableInspectorClose={() => setVariableInspectorOpen(false)} onRefreshVariables={handleRefreshVariables}
        packageInspectorOpen={packageInspectorOpen}
        onPackageInspectorClose={() => setPackageInspectorOpen(false)} onRefreshPackages={handleRefreshPackages}
        onInstallPackage={handleInstallPackage} onUninstallPackage={handleUninstallPackage}
        findReplaceOpen={findReplace.findReplaceOpen} onFindReplaceClose={() => findReplace.setFindReplaceOpen(false)}
        onSearch={findReplace.handleSearch} onReplace={findReplace.handleReplace}
        onReplaceAll={findReplace.handleReplaceAll} onNavigate={(cellId) => notebookHook.setActiveCellId(cellId)}
      />
    </div>
  );
}
