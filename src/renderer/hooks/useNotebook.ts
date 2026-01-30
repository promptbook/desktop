import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  NotebookState,
  CellState,
  CellType,
} from '@promptbook/core/ui';
import {
  createEmptyNotebook,
  createCodeCell,
  createTextCell,
} from '@promptbook/core/ui';
import {
  generatePipInstallCommand,
  countPipInstalls,
} from '@promptbook/core/utils';
import { useCellExecution } from './useCellExecution';
import type { PackageInstallModalState } from './useCellExecution';

export type InstallAction = 'once' | 'current-cell' | 'setup-cell';

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

export function useNotebook(
  initialFilePath: string | null,
  projectId: string | undefined,
  onError: (error: string) => void,
  setEnvironmentPickerOpen: (open: boolean) => void,
  handleSaveVersion: (message: string) => Promise<void>
): UseNotebookReturn {
  const [notebook, setNotebook] = useState<NotebookState>(createEmptyNotebook());
  const [filePath, setFilePath] = useState<string | null>(initialFilePath);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [copiedCell, setCopiedCell] = useState<CellState | null>(null);
  const [commandMode, setCommandMode] = useState(true);
  const [packageInstallModal, setPackageInstallModal] = useState<PackageInstallModalState>({
    isOpen: false,
    packages: [],
    cellId: '',
  });
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [packageInstallError, setPackageInstallError] = useState<string | null>(null);

  // Track current file path to avoid re-loading the same file
  const currentFileRef = useRef<string | null>(initialFilePath);

  // Load file when filePath prop changes (project mode)
  useEffect(() => {
    if (projectId && initialFilePath && initialFilePath !== currentFileRef.current) {
      currentFileRef.current = initialFilePath;
      window.promptbook.project.readFile(projectId, initialFilePath).then((result) => {
        if (result.success && result.content) {
          try {
            const parsed = JSON.parse(result.content);
            setNotebook(parsed);
            setFilePath(initialFilePath);
          } catch {
            setFilePath(initialFilePath);
          }
        }
      });
    }
  }, [projectId, initialFilePath]);

  // Set initial active cell when notebook loads
  useEffect(() => {
    if (notebook.cells.length > 0 && !activeCellId) {
      setActiveCellId(notebook.cells[0].id);
    }
  }, [notebook.cells, activeCellId]);

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

  // Use cell execution hook
  const { handleRunCell, handleSyncCell } = useCellExecution({
    notebook,
    handleUpdate,
    handleSaveVersion,
    onError,
    setEnvironmentPickerOpen,
    setPackageInstallModal,
    setPackageInstallError,
  });

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

  const handleCopyCell = useCallback(() => {
    if (!activeCellId) return;
    const cell = notebook.cells.find((c) => c.id === activeCellId);
    if (cell) {
      setCopiedCell({ ...cell });
    }
  }, [activeCellId, notebook.cells]);

  const handleCutCell = useCallback(() => {
    if (!activeCellId) return;
    handleCopyCell();
    handleDeleteCell(activeCellId);
    const index = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (index < notebook.cells.length - 1) {
      setActiveCellId(notebook.cells[index + 1].id);
    } else if (index > 0) {
      setActiveCellId(notebook.cells[index - 1].id);
    }
  }, [activeCellId, handleCopyCell, handleDeleteCell, notebook.cells]);

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

  const handleRunAllCells = useCallback(async () => {
    const codeCells = notebook.cells.filter((c) => c.cellType === 'code');
    for (const cell of codeCells) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, handleRunCell]);

  const handleRunAbove = useCallback(async () => {
    if (!activeCellId) return;
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex <= 0) return;
    const cellsAbove = notebook.cells.slice(0, activeIndex).filter((c) => c.cellType === 'code');
    for (const cell of cellsAbove) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, activeCellId, handleRunCell]);

  const handleRunBelow = useCallback(async () => {
    if (!activeCellId) return;
    const activeIndex = notebook.cells.findIndex((c) => c.id === activeCellId);
    if (activeIndex === -1) return;
    const cellsBelow = notebook.cells.slice(activeIndex).filter((c) => c.cellType === 'code');
    for (const cell of cellsBelow) {
      await handleRunCell(cell.id);
    }
  }, [notebook.cells, activeCellId, handleRunCell]);

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

  const handleInstallPackages = useCallback(async (packages: string[], action: InstallAction) => {
    setIsInstallingPackages(true);
    setPackageInstallError(null);

    try {
      const pipCommand = generatePipInstallCommand(packages, action !== 'once');

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
            cells: prev.cells.map(c =>
              c.id === packageInstallModal.cellId ? { ...c, code: newCode } : c
            ),
          }));
        }
      } else if (action === 'setup-cell') {
        const cellWithManyPips = notebook.cells.find(
          c => c.cellType === 'code' && countPipInstalls(c.code || '') >= 2
        );

        if (cellWithManyPips) {
          const newCode = `${cellWithManyPips.code}\n${pipCommand}`;
          setNotebook(prev => ({
            ...prev,
            cells: prev.cells.map(c =>
              c.id === cellWithManyPips.id ? { ...c, code: newCode } : c
            ),
          }));
        } else {
          const firstCell = notebook.cells[0];
          if (firstCell?.cellType === 'code' && countPipInstalls(firstCell.code || '') > 0) {
            const newCode = `${firstCell.code}\n${pipCommand}`;
            setNotebook(prev => ({
              ...prev,
              cells: prev.cells.map((c, i) =>
                i === 0 ? { ...c, code: newCode } : c
              ),
            }));
          } else {
            const setupCell = createCodeCell(`cell-setup-${Date.now()}`);
            setupCell.shortDescription = 'Install required packages';
            setupCell.code = `# Setup - Install required packages\n${pipCommand}`;
            setNotebook(prev => ({
              ...prev,
              cells: [setupCell, ...prev.cells],
            }));
          }
        }
      }

      setPackageInstallModal({ isOpen: false, packages: [], cellId: '' });
    } catch (error) {
      setPackageInstallError(String(error));
    } finally {
      setIsInstallingPackages(false);
    }
  }, [notebook.cells, packageInstallModal.cellId]);

  const listFiles = useCallback(async (dirPath?: string) => {
    const result = await window.promptbook.file.listDir(dirPath);
    if (result.success) {
      return {
        files: result.files.map((f) => ({
          name: f.name,
          path: f.path,
          isDirectory: f.isDirectory,
        })),
        cwd: result.cwd,
      };
    }
    return { files: [], cwd: '' };
  }, []);

  return {
    notebook,
    setNotebook,
    filePath,
    setFilePath,
    activeCellId,
    setActiveCellId,
    copiedCell,
    commandMode,
    setCommandMode,
    packageInstallModal,
    setPackageInstallModal,
    isInstallingPackages,
    packageInstallError,
    setPackageInstallError,
    handleUpdate,
    handleAddCell,
    handleAddCellAbove,
    handleMoveCell,
    handleDeleteCell,
    handleCopyCell,
    handleCutCell,
    handlePasteCell,
    handleRunCell,
    handleRunAllCells,
    handleRunAbove,
    handleRunBelow,
    handleSyncCell,
    handleClearAllOutputs,
    handleInstallPackages,
    listFiles,
  };
}

export { PackageInstallModalState };
