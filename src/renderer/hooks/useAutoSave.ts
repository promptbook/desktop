import { useState, useEffect, useRef } from 'react';
import type { NotebookState } from '@promptbook/core';

export interface UseAutoSaveReturn {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  lastSavedAt: Date | null;
  setLastSavedAt: (date: Date | null) => void;
}

export function useAutoSave(
  notebook: NotebookState,
  filePath: string | null,
  projectId?: string,
  autoSaveIntervalMs: number = 30000
): UseAutoSaveReturn {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotebookStateRef = useRef<string>(JSON.stringify(notebook));

  // Track notebook changes
  useEffect(() => {
    const currentState = JSON.stringify(notebook);
    if (currentState !== lastNotebookStateRef.current) {
      setHasUnsavedChanges(true);
    }
    lastNotebookStateRef.current = currentState;
  }, [notebook]);

  // Auto-save interval
  useEffect(() => {
    const autoSave = async () => {
      if (hasUnsavedChanges && filePath) {
        try {
          if (projectId) {
            // Project mode: use project saveNotebook API with relative path
            await window.promptbook.project.saveNotebook(projectId, filePath, notebook);
          } else {
            // Standalone mode: use file.save API with absolute path
            await window.promptbook.file.save(filePath, notebook);
          }
          setHasUnsavedChanges(false);
          setLastSavedAt(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    };

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up new interval
    autoSaveIntervalRef.current = setInterval(autoSave, autoSaveIntervalMs);

    // Cleanup on unmount
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [hasUnsavedChanges, filePath, projectId, notebook, autoSaveIntervalMs]);

  return {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    lastSavedAt,
    setLastSavedAt,
  };
}
