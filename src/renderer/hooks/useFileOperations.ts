import { useCallback } from 'react';
import { UseNotebookReturn } from './useNotebook';
import { UseAutoSaveReturn } from './useAutoSave';

export interface UseFileOperationsReturn {
  handleOpen: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleExportPython: () => Promise<void>;
}

/**
 * Hook to manage file operations (open, save, export)
 */
export function useFileOperations(
  notebookHook: UseNotebookReturn,
  autoSave: UseAutoSaveReturn,
  setGlobalError: (error: string | null) => void
): UseFileOperationsReturn {
  const handleOpen = useCallback(async () => {
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
  }, [notebookHook]);

  const handleSave = useCallback(async () => {
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
  }, [notebookHook, autoSave]);

  const handleExportPython = useCallback(async () => {
    const result = await window.promptbook.file.exportPython(notebookHook.notebook);
    if (result.success && result.filePath) {
      setGlobalError(null);
    }
  }, [notebookHook.notebook, setGlobalError]);

  return {
    handleOpen,
    handleSave,
    handleExportPython,
  };
}
