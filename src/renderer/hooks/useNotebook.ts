import { useState, useCallback, useEffect, useRef } from 'react';
import * as yaml from 'yaml';
import type {
  NotebookState,
  CellState,
  CellType,
} from '@promptbook/ui';
import {
  createEmptyNotebook,
  createCodeCell,
  createTextCell,
} from '@promptbook/ui';
import {
  generatePipInstallCommand,
  countPipInstalls,
} from '@promptbook/types';
import { useCellExecution } from './useCellExecution';
import type { PackageInstallModalState } from './useCellExecution';
import { useBackgroundSync } from './useBackgroundSync';

export type InstallAction = 'once' | 'current-cell' | 'setup-cell';

import type { GeneratedSymbol } from '@promptbook/types';

export interface UseNotebookReturn {
  notebook: NotebookState;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
  filePath: string | null;
  setFilePath: (path: string | null) => void;
  activeCellId: string | null;
  setActiveCellId: (id: string | null) => void;
  copiedCell: CellState | null;
  commandMode: boolean;
  setCommandMode: (mode: boolean) => void;
  packageInstallModal: PackageInstallModalState;
  setPackageInstallModal: React.Dispatch<React.SetStateAction<PackageInstallModalState>>;
  isInstallingPackages: boolean;
  packageInstallError: string | null;
  setPackageInstallError: (error: string | null) => void;
  /** Notebook-level symbols for # autocomplete (from LLM code generation) */
  notebookSymbols: GeneratedSymbol[];
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  handleAddCell: (afterCellId?: string, cellType?: CellType) => void;
  handleAddCellAbove: (cellType?: CellType) => void;
  handleMoveCell: (cellId: string, direction: 'up' | 'down') => void;
  handleDeleteCell: (cellId: string) => void;
  handleCopyCell: () => void;
  handleCutCell: () => void;
  handlePasteCell: () => void;
  handleRunCell: (cellId: string) => Promise<void>;
  handleRunAllCells: () => Promise<void>;
  handleRunAbove: () => Promise<void>;
  handleRunBelow: () => Promise<void>;
  handleSyncCell: (cellId: string) => Promise<void>;
  handleClearAllOutputs: () => void;
  handleInstallPackages: (packages: string[], action: InstallAction) => Promise<void>;
  listFiles: (dirPath?: string) => Promise<{ files: { name: string; path: string; isDirectory: boolean }[]; cwd: string }>;
}

// ============================================================================
// Cell Operations Factory
// ============================================================================

interface CellOperationsConfig {
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
  defaultTab: 'short' | 'pseudo' | 'code';
  getActiveCellId: () => string | null;
  setActiveCellId: (id: string | null) => void;
}

function createCellOperations(config: CellOperationsConfig) {
  const { setNotebook, defaultTab, getActiveCellId, setActiveCellId } = config;

  const handleAddCell = (afterCellId?: string, cellType: CellType = 'code') => {
    const newCell = cellType === 'text'
      ? createTextCell(`cell-${Date.now()}`)
      : createCodeCell(`cell-${Date.now()}`);
    if (cellType === 'code') newCell.lastEditedTab = defaultTab;
    setNotebook((prev) => {
      if (!afterCellId) return { ...prev, cells: [...prev.cells, newCell] };
      const index = prev.cells.findIndex((c) => c.id === afterCellId);
      const newCells = [...prev.cells];
      newCells.splice(index + 1, 0, newCell);
      return { ...prev, cells: newCells };
    });
  };

  const handleAddCellAbove = (cellType: CellType = 'code') => {
    const activeCellId = getActiveCellId();
    const newCell = cellType === 'text'
      ? createTextCell(`cell-${Date.now()}`)
      : createCodeCell(`cell-${Date.now()}`);
    if (cellType === 'code') newCell.lastEditedTab = defaultTab;
    setNotebook((prev) => {
      if (!activeCellId) return { ...prev, cells: [newCell, ...prev.cells] };
      const index = prev.cells.findIndex((c) => c.id === activeCellId);
      const newCells = [...prev.cells];
      newCells.splice(index, 0, newCell);
      return { ...prev, cells: newCells };
    });
    setActiveCellId(newCell.id);
  };

  const handleMoveCell = (cellId: string, direction: 'up' | 'down') => {
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
  };

  const handleDeleteCell = (cellId: string) => {
    setNotebook((prev) => ({ ...prev, cells: prev.cells.filter((c) => c.id !== cellId) }));
  };

  return { handleAddCell, handleAddCellAbove, handleMoveCell, handleDeleteCell };
}

// ============================================================================
// Copy/Paste Operations Factory
// ============================================================================

interface CopyPasteConfig {
  getNotebook: () => NotebookState;
  getActiveCellId: () => string | null;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
  setActiveCellId: (id: string | null) => void;
  setCopiedCell: (cell: CellState | null) => void;
  getCopiedCell: () => CellState | null;
  handleDeleteCell: (cellId: string) => void;
}

function createCopyPasteOperations(config: CopyPasteConfig) {
  const { getNotebook, getActiveCellId, setNotebook, setActiveCellId, setCopiedCell, getCopiedCell, handleDeleteCell } = config;

  const handleCopyCell = () => {
    const activeCellId = getActiveCellId();
    if (!activeCellId) return;
    const cell = getNotebook().cells.find((c) => c.id === activeCellId);
    if (cell) setCopiedCell({ ...cell });
  };

  const handleCutCell = () => {
    const activeCellId = getActiveCellId();
    const notebook = getNotebook();
    if (!activeCellId) return;
    handleCopyCell();
    handleDeleteCell(activeCellId);
    const index = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (index < notebook.cells.length - 1) setActiveCellId(notebook.cells[index + 1].id);
    else if (index > 0) setActiveCellId(notebook.cells[index - 1].id);
  };

  const handlePasteCell = () => {
    const copiedCell = getCopiedCell();
    const activeCellId = getActiveCellId();
    if (!copiedCell) return;
    const newCell = { ...copiedCell, id: `cell-${Date.now()}` };
    setNotebook((prev) => {
      if (!activeCellId) return { ...prev, cells: [...prev.cells, newCell] };
      const index = prev.cells.findIndex((c) => c.id === activeCellId);
      const newCells = [...prev.cells];
      newCells.splice(index + 1, 0, newCell);
      return { ...prev, cells: newCells };
    });
    setActiveCellId(newCell.id);
  };

  return { handleCopyCell, handleCutCell, handlePasteCell };
}

// ============================================================================
// Run Operations Factory
// ============================================================================

function createRunOperations(
  getNotebook: () => NotebookState,
  getActiveCellId: () => string | null,
  handleRunCell: (cellId: string) => Promise<void>
) {
  const handleRunAllCells = async () => {
    for (const cell of getNotebook().cells.filter((c) => c.cellType === 'code')) {
      await handleRunCell(cell.id);
    }
  };

  const handleRunAbove = async () => {
    const activeCellId = getActiveCellId();
    if (!activeCellId) return;
    const notebook = getNotebook();
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex <= 0) return;
    for (const cell of notebook.cells.slice(0, activeIndex).filter((c) => c.cellType === 'code')) {
      await handleRunCell(cell.id);
    }
  };

  const handleRunBelow = async () => {
    const activeCellId = getActiveCellId();
    if (!activeCellId) return;
    const notebook = getNotebook();
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex === -1) return;
    for (const cell of notebook.cells.slice(activeIndex).filter((c) => c.cellType === 'code')) {
      await handleRunCell(cell.id);
    }
  };

  return { handleRunAllCells, handleRunAbove, handleRunBelow };
}

// ============================================================================
// Package Install Logic
// ============================================================================

async function handleInstallPackagesLogic(
  packages: string[],
  action: InstallAction,
  getNotebook: () => NotebookState,
  packageInstallModal: PackageInstallModalState,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>,
  setPackageInstallModal: React.Dispatch<React.SetStateAction<PackageInstallModalState>>,
  setIsInstallingPackages: (installing: boolean) => void,
  setPackageInstallError: (error: string | null) => void
): Promise<void> {
  setIsInstallingPackages(true);
  setPackageInstallError(null);

  try {
    const pipCommand = generatePipInstallCommand(packages, action !== 'once');
    const notebook = getNotebook();

    if (action === 'once') {
      const result = await window.promptbook.kernel.execute(`!${pipCommand.replace('!', '')}`);
      if (!result.success) {
        setPackageInstallError(result.error || 'Failed to install packages');
        return;
      }
    } else if (action === 'current-cell') {
      const cell = notebook.cells.find(c => c.id === packageInstallModal.cellId);
      if (cell) {
        const newCode = `${pipCommand}\n\n${cell.code || ''}`;
        setNotebook(prev => ({
          ...prev,
          cells: prev.cells.map(c => c.id === packageInstallModal.cellId ? { ...c, code: newCode } : c),
        }));
      }
    } else if (action === 'setup-cell') {
      handleSetupCellInstall(pipCommand, notebook, setNotebook);
    }

    setPackageInstallModal({ isOpen: false, packages: [], cellId: '' });
  } catch (error) {
    setPackageInstallError(String(error));
  } finally {
    setIsInstallingPackages(false);
  }
}

function handleSetupCellInstall(
  pipCommand: string,
  notebook: NotebookState,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): void {
  const cellWithManyPips = notebook.cells.find(c => c.cellType === 'code' && countPipInstalls(c.code || '') >= 2);

  if (cellWithManyPips) {
    setNotebook(prev => ({
      ...prev,
      cells: prev.cells.map(c => c.id === cellWithManyPips.id ? { ...c, code: `${cellWithManyPips.code}\n${pipCommand}` } : c),
    }));
  } else {
    const firstCell = notebook.cells[0];
    if (firstCell?.cellType === 'code' && countPipInstalls(firstCell.code || '') > 0) {
      setNotebook(prev => ({
        ...prev,
        cells: prev.cells.map((c, i) => i === 0 ? { ...c, code: `${firstCell.code}\n${pipCommand}` } : c),
      }));
    } else {
      const setupCell = createCodeCell(`cell-setup-${Date.now()}`);
      setupCell.shortDescription = 'Install required packages';
      setupCell.code = `# Setup - Install required packages\n${pipCommand}`;
      setNotebook(prev => ({ ...prev, cells: [setupCell, ...prev.cells] }));
    }
  }
}

// ============================================================================
// File Load Effect
// ============================================================================

function useFileLoadEffect(
  projectId: string | undefined,
  initialFilePath: string | null,
  currentFileRef: React.MutableRefObject<string | null>,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>,
  setFilePath: (path: string | null) => void
) {
  useEffect(() => {
    if (projectId && initialFilePath && initialFilePath !== currentFileRef.current) {
      currentFileRef.current = initialFilePath;
      window.promptbook.project.readFile(projectId, initialFilePath).then((result) => {
        if (result.success && result.content) {
          try {
            // Parse YAML content (notebooks are saved as YAML)
            const parsed = yaml.parse(result.content);
            setNotebook(parsed);
            setFilePath(initialFilePath);

            // Set the kernel working directory to the notebook's directory
            const notebookDir = initialFilePath.substring(0, initialFilePath.lastIndexOf('/'));
            if (notebookDir) {
              window.promptbook.kernel.setWorkingDir(notebookDir).catch(err => {
                console.error('Failed to set working directory:', err);
              });
            }
          } catch (err) {
            console.error('Failed to parse notebook:', err);
            setFilePath(initialFilePath);
          }
        }
      });
    }
  }, [projectId, initialFilePath, currentFileRef, setNotebook, setFilePath]);
}

// ============================================================================
// Utility Handlers
// ============================================================================

async function listFilesHelper(projectId: string | undefined, relativePath?: string) {
  if (!projectId) {
    return { files: [], cwd: '' };
  }
  const result = await window.promptbook.project.listFiles(projectId, relativePath);
  if (result.success) {
    return {
      files: result.files.map((f: { name: string; path: string; isDirectory: boolean }) => ({
        name: f.name,
        path: f.path,
        isDirectory: f.isDirectory,
      })),
      cwd: result.cwd,
    };
  }
  return { files: [], cwd: '' };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useNotebook(
  initialFilePath: string | null,
  projectId: string | undefined,
  onError: (error: string) => void,
  setEnvironmentPickerOpen: (open: boolean) => void,
  handleSaveVersion: (message: string) => Promise<void>,
  defaultTab: 'short' | 'pseudo' | 'code' = 'short'
): UseNotebookReturn {
  const [notebook, setNotebook] = useState<NotebookState>(createEmptyNotebook());
  const [filePath, setFilePath] = useState<string | null>(initialFilePath);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [copiedCell, setCopiedCell] = useState<CellState | null>(null);
  const [commandMode, setCommandMode] = useState(true);
  const [packageInstallModal, setPackageInstallModal] = useState<PackageInstallModalState>({ isOpen: false, packages: [], cellId: '' });
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [packageInstallError, setPackageInstallError] = useState<string | null>(null);

  const notebookRef = useRef(notebook);
  const activeCellIdRef = useRef(activeCellId);
  const copiedCellRef = useRef(copiedCell);
  // Initialize to null so the first load effect runs
  const currentFileRef = useRef<string | null>(null);

  useEffect(() => { notebookRef.current = notebook; }, [notebook]);
  useEffect(() => { activeCellIdRef.current = activeCellId; }, [activeCellId]);
  useEffect(() => { copiedCellRef.current = copiedCell; }, [copiedCell]);

  const getNotebook = useCallback(() => notebookRef.current, []);
  const getActiveCellId = useCallback(() => activeCellIdRef.current, []);
  const getCopiedCell = useCallback(() => copiedCellRef.current, []);

  useFileLoadEffect(projectId, initialFilePath, currentFileRef, setNotebook, setFilePath);
  useEffect(() => { if (notebook.cells.length > 0 && !activeCellId) setActiveCellId(notebook.cells[0].id); }, [notebook.cells, activeCellId]);

  const handleUpdate = useCallback((cellId: string, updates: Partial<CellState>) => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => cell.id === cellId ? { ...cell, ...updates } : cell),
      metadata: { ...prev.metadata, modified: new Date().toISOString() },
    }));
  }, []);

  // Background sync for immediate code execution
  const backgroundSync = useBackgroundSync({ handleUpdate, setNotebook });

  const { handleRunCell, handleSyncCell } = useCellExecution({
    notebook, setNotebook, handleUpdate, handleSaveVersion, onError, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError, backgroundSync,
  });

  const cellOps = createCellOperations({ setNotebook, defaultTab, getActiveCellId, setActiveCellId });
  const copyPasteOps = createCopyPasteOperations({
    getNotebook, getActiveCellId, setNotebook, setActiveCellId, setCopiedCell, getCopiedCell, handleDeleteCell: cellOps.handleDeleteCell,
  });
  const runOps = createRunOperations(getNotebook, getActiveCellId, handleRunCell);
  const handleClearAllOutputs = useCallback(() => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => ({
        ...cell, outputs: [], lastExecutionTime: undefined, lastExecutionSuccess: undefined,
      })),
    }));
  }, []);
  const handleInstallPackages = useCallback(
    (packages: string[], action: InstallAction) => handleInstallPackagesLogic(
      packages, action, getNotebook, packageInstallModal, setNotebook, setPackageInstallModal, setIsInstallingPackages, setPackageInstallError
    ),
    [getNotebook, packageInstallModal]
  );
  const listFiles = useCallback(
    (relativePath?: string) => listFilesHelper(projectId, relativePath),
    [projectId]
  );

  // Get notebook-level symbols for # autocomplete (from LLM code generation)
  const notebookSymbols = notebook.metadata?.symbols || [];

  return {
    notebook, setNotebook, filePath, setFilePath, activeCellId, setActiveCellId, copiedCell, commandMode, setCommandMode,
    packageInstallModal, setPackageInstallModal, isInstallingPackages, packageInstallError, setPackageInstallError,
    notebookSymbols, handleUpdate,
    handleAddCell: cellOps.handleAddCell, handleAddCellAbove: cellOps.handleAddCellAbove,
    handleMoveCell: cellOps.handleMoveCell, handleDeleteCell: cellOps.handleDeleteCell,
    handleCopyCell: copyPasteOps.handleCopyCell, handleCutCell: copyPasteOps.handleCutCell, handlePasteCell: copyPasteOps.handlePasteCell,
    handleRunCell, handleRunAllCells: runOps.handleRunAllCells, handleRunAbove: runOps.handleRunAbove, handleRunBelow: runOps.handleRunBelow,
    handleSyncCell, handleClearAllOutputs, handleInstallPackages, listFiles,
  };
}

export { PackageInstallModalState };
