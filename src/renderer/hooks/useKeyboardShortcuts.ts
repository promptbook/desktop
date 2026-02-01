import { useEffect, useCallback, useRef } from 'react';
import type { CellState, NotebookState } from '@promptbook/core';

interface UseKeyboardShortcutsParams {
  notebook: NotebookState;
  activeCellId: string | null;
  commandMode: boolean;
  canUndo: boolean;
  setCommandMode: (mode: boolean) => void;
  setActiveCellId: (id: string | null) => void;
  setVariableInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFindReplaceOpen: (open: boolean) => void;
  handleRunCell: (cellId: string) => Promise<void>;
  handleRunAllCells: () => Promise<void>;
  handleAddCell: (afterCellId?: string, cellType?: 'code' | 'text') => void;
  handleAddCellAbove: (cellType?: 'code' | 'text') => void;
  handleDeleteCell: (cellId: string) => void;
  handleCopyCell: () => void;
  handleCutCell: () => void;
  handlePasteCell: () => void;
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  handleUndo: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleOpen: () => Promise<void>;
}

interface GlobalShortcutHandlers {
  handleRunAllCells: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleOpen: () => Promise<void>;
  setVariableInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleUndo: () => Promise<void>;
  setFindReplaceOpen: (open: boolean) => void;
  canUndo: boolean;
}

/** Handle global shortcuts that work in any mode */
function handleGlobalShortcuts(e: KeyboardEvent, handlers: GlobalShortcutHandlers): boolean {
  // Meta+Shift+Enter: Run all cells
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    handlers.handleRunAllCells();
    return true;
  }

  // Meta+S: Save
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    handlers.handleSave();
    return true;
  }

  // Meta+O: Open
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    handlers.handleOpen();
    return true;
  }

  // Alt+V: Toggle variable inspector
  if (e.altKey && e.key === 'v') {
    e.preventDefault();
    handlers.setVariableInspectorOpen((prev) => !prev);
    return true;
  }

  // Cmd+Z: Undo
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && handlers.canUndo) {
    e.preventDefault();
    handlers.handleUndo();
    return true;
  }

  // Cmd+F: Find
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault();
    handlers.setFindReplaceOpen(true);
    return true;
  }

  return false;
}

interface EditModeHandlers {
  activeCellId: string | null;
  notebook: NotebookState;
  handleRunCell: (cellId: string) => Promise<void>;
  handleAddCell: (afterCellId?: string, cellType?: 'code' | 'text') => void;
  setActiveCellId: (id: string | null) => void;
  setCommandMode: (mode: boolean) => void;
}

/** Handle shortcuts when in edit mode (inside an input/textarea) */
function handleEditModeShortcuts(e: KeyboardEvent, handlers: EditModeHandlers): boolean {
  // Shift+Enter: run and advance
  if (e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    if (handlers.activeCellId) {
      handlers.handleRunCell(handlers.activeCellId).then(() => {
        const index = handlers.notebook.cells.findIndex((c) => c.id === handlers.activeCellId);
        if (index < handlers.notebook.cells.length - 1) {
          handlers.setActiveCellId(handlers.notebook.cells[index + 1].id);
        } else {
          handlers.handleAddCell(handlers.activeCellId!, 'code');
        }
      });
    }
    return true;
  }

  // Ctrl+Enter: run current
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (handlers.activeCellId) handlers.handleRunCell(handlers.activeCellId);
    return true;
  }

  // Escape: enter command mode
  if (e.key === 'Escape') {
    e.preventDefault();
    handlers.setCommandMode(true);
    (document.activeElement as HTMLElement)?.blur();
    return true;
  }

  return false;
}

interface CommandModeHandlers {
  activeCellId: string | null;
  notebook: NotebookState;
  setCommandMode: (mode: boolean) => void;
  setActiveCellId: (id: string | null) => void;
  handleRunCell: (cellId: string) => Promise<void>;
  handleAddCell: (afterCellId?: string, cellType?: 'code' | 'text') => void;
  handleAddCellAbove: (cellType?: 'code' | 'text') => void;
  handleDeleteCell: (cellId: string) => void;
  handleCopyCell: () => void;
  handleCutCell: () => void;
  handlePasteCell: () => void;
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  deleteState: { count: number; timeout: ReturnType<typeof setTimeout> | null };
}

/** Handle cell manipulation shortcuts (add, delete, copy, cut, paste) */
function handleCellManipulationShortcuts(e: KeyboardEvent, handlers: CommandModeHandlers): boolean {
  const { activeCellId, notebook, deleteState } = handlers;

  // A: add cell above
  if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    handlers.handleAddCellAbove('code');
    return true;
  }

  // B: add cell below
  if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    if (activeCellId) handlers.handleAddCell(activeCellId, 'code');
    return true;
  }

  // DD: delete cell (double-d)
  if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    deleteState.count++;
    if (deleteState.timeout) clearTimeout(deleteState.timeout);
    if (deleteState.count >= 2) {
      deleteState.count = 0;
      if (activeCellId) {
        const index = notebook.cells.findIndex((c) => c.id === activeCellId);
        handlers.handleDeleteCell(activeCellId);
        if (notebook.cells.length > 1) {
          handlers.setActiveCellId(notebook.cells[Math.min(index, notebook.cells.length - 2)]?.id || null);
        }
      }
    } else {
      deleteState.timeout = setTimeout(() => { deleteState.count = 0; }, 500);
    }
    return true;
  }

  // X: cut cell
  if (e.key === 'x' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    handlers.handleCutCell();
    return true;
  }

  // C: copy cell
  if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    handlers.handleCopyCell();
    return true;
  }

  // V: paste cell
  if (e.key === 'v' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    handlers.handlePasteCell();
    return true;
  }

  return false;
}

/** Handle navigation and cell type shortcuts */
function handleNavigationShortcuts(e: KeyboardEvent, handlers: CommandModeHandlers): boolean {
  const { activeCellId, notebook } = handlers;

  // Enter: edit mode
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    handlers.setCommandMode(false);
    return true;
  }

  // Shift+Enter: run and advance
  if (e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    if (activeCellId) {
      handlers.handleRunCell(activeCellId).then(() => {
        const index = notebook.cells.findIndex((c) => c.id === activeCellId);
        if (index < notebook.cells.length - 1) {
          handlers.setActiveCellId(notebook.cells[index + 1].id);
        }
      });
    }
    return true;
  }

  // Ctrl/Cmd+Enter: run current
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (activeCellId) handlers.handleRunCell(activeCellId);
    return true;
  }

  // Up/K: select cell above
  if ((e.key === 'ArrowUp' || e.key === 'k') && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    if (activeCellId) {
      const index = notebook.cells.findIndex((c) => c.id === activeCellId);
      if (index > 0) handlers.setActiveCellId(notebook.cells[index - 1].id);
    }
    return true;
  }

  // Down/J: select cell below
  if ((e.key === 'ArrowDown' || e.key === 'j') && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    if (activeCellId) {
      const index = notebook.cells.findIndex((c) => c.id === activeCellId);
      if (index < notebook.cells.length - 1) handlers.setActiveCellId(notebook.cells[index + 1].id);
    }
    return true;
  }

  // M: convert to markdown
  if (e.key === 'm' && !e.metaKey && !e.ctrlKey && activeCellId) {
    e.preventDefault();
    handlers.handleUpdate(activeCellId, { cellType: 'text' });
    return true;
  }

  // Y: convert to code
  if (e.key === 'y' && !e.metaKey && !e.ctrlKey && activeCellId) {
    e.preventDefault();
    handlers.handleUpdate(activeCellId, { cellType: 'code' });
    return true;
  }

  return false;
}

export function useKeyboardShortcuts({
  notebook,
  activeCellId,
  commandMode,
  canUndo,
  setCommandMode,
  setActiveCellId,
  setVariableInspectorOpen,
  setFindReplaceOpen,
  handleRunCell,
  handleRunAllCells,
  handleAddCell,
  handleAddCellAbove,
  handleDeleteCell,
  handleCopyCell,
  handleCutCell,
  handlePasteCell,
  handleUpdate,
  handleUndo,
  handleSave,
  handleOpen,
}: UseKeyboardShortcutsParams): void {
  const deleteStateRef = useRef({ count: 0, timeout: null as ReturnType<typeof setTimeout> | null });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Global shortcuts (work in any mode)
    const globalHandlers: GlobalShortcutHandlers = {
      handleRunAllCells, handleSave, handleOpen,
      setVariableInspectorOpen, handleUndo, setFindReplaceOpen, canUndo,
    };
    if (handleGlobalShortcuts(e, globalHandlers)) return;

    // Edit mode shortcuts (when in input and not command mode)
    if (isInInput && !commandMode) {
      const editHandlers: EditModeHandlers = {
        activeCellId, notebook, handleRunCell, handleAddCell, setActiveCellId, setCommandMode,
      };
      handleEditModeShortcuts(e, editHandlers);
      return;
    }

    // Command mode shortcuts (when not in input)
    if (!isInInput) {
      const cmdHandlers: CommandModeHandlers = {
        activeCellId, notebook, setCommandMode, setActiveCellId,
        handleRunCell, handleAddCell, handleAddCellAbove, handleDeleteCell,
        handleCopyCell, handleCutCell, handlePasteCell, handleUpdate,
        deleteState: deleteStateRef.current,
      };

      if (handleNavigationShortcuts(e, cmdHandlers)) return;
      handleCellManipulationShortcuts(e, cmdHandlers);
    }
  }, [
    activeCellId, commandMode, notebook, canUndo,
    handleRunCell, handleRunAllCells, handleAddCell, handleAddCellAbove,
    handleDeleteCell, handleCopyCell, handleCutCell, handlePasteCell,
    handleUpdate, handleUndo, handleSave, handleOpen,
    setCommandMode, setActiveCellId, setVariableInspectorOpen, setFindReplaceOpen,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    const deleteState = deleteStateRef.current;
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (deleteState.timeout) {
        clearTimeout(deleteState.timeout);
      }
    };
  }, [handleKeyDown]);
}
