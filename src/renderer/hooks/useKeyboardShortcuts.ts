import { useEffect } from 'react';
import type { CellState, NotebookState } from '@promptbook/core/ui';

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

      // Command mode shortcuts (only when not in any input field)
      if (!isInInput) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCellId, commandMode, notebook.cells, handleRunCell, handleAddCell, handleAddCellAbove, handleDeleteCell, handleCopyCell, handleCutCell, handlePasteCell, handleRunAllCells, handleUpdate, canUndo, handleUndo]);
}
