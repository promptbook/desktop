import { useState, useCallback } from 'react';
import { NotebookState } from '@promptbook/core';
import { UseNotebookReturn } from './useNotebook';

export interface UseVersionControlReturn {
  canUndo: boolean;
  handleUndo: () => Promise<void>;
  handleSaveVersion: (message: string) => Promise<void>;
}

/**
 * Hook to manage version control (save/restore versions)
 */
export function useVersionControl(
  notebookHook: UseNotebookReturn,
  setGlobalError: (error: string | null) => void
): UseVersionControlReturn {
  const [canUndo, setCanUndo] = useState(false);

  // Compute notebookId for version control
  const notebookId = notebookHook.filePath
    ? notebookHook.filePath.replace(/[^a-zA-Z0-9]/g, '_')
    : `untitled_${Date.now()}`;

  const handleSaveVersion = useCallback(async (message: string) => {
    const content = JSON.stringify(notebookHook.notebook, null, 2);
    await window.promptbook.version.save(notebookId, content, message);
    const canUndoResult = await window.promptbook.version.canUndo(notebookId);
    setCanUndo(canUndoResult.canUndo);
  }, [notebookHook.notebook, notebookId]);

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
  }, [notebookId, notebookHook, setGlobalError]);

  return {
    canUndo,
    handleUndo,
    handleSaveVersion,
  };
}
