// packages/electron/src/renderer/hooks/useGenerateCells.ts
// Hook for generating multiple notebook cells from a description

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CellState, NotebookState } from '@promptbook/core';
import { createCodeCell, createTextCell } from '@promptbook/core';
import type { GenerateCellsStreamEvent } from '../types';

interface UseGenerateCellsOptions {
  notebook: NotebookState;
  projectId: string | undefined;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
}

interface UseGenerateCellsReturn {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isGenerating: boolean;
  streamingContent: string;
  progress: { current: number; total: number } | undefined;
  error: string | null;
  handleGenerate: (description: string, fileRefs: string[]) => void;
}

export function useGenerateCells({
  notebook,
  projectId,
  setNotebook,
}: UseGenerateCellsOptions): UseGenerateCellsReturn {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>();
  const [error, setError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    setError(null);
    setStreamingContent('');
    setProgress(undefined);
  }, []);

  const closeModal = useCallback(() => {
    if (isGenerating) return;
    setIsModalOpen(false);
    setError(null);
    setStreamingContent('');
    setProgress(undefined);
  }, [isGenerating]);

  const handleGenerate = useCallback(async (description: string, fileRefs: string[]) => {
    if (isGenerating || !projectId) return;

    setIsGenerating(true);
    setError(null);
    setStreamingContent('');
    setProgress(undefined);

    try {
      // Load file contents for referenced files
      const fileContents: Record<string, string> = {};
      for (const fileRef of fileRefs) {
        try {
          const result = await window.promptbook.project.readFile(projectId, fileRef);
          if (result.success && result.content) {
            fileContents[fileRef] = result.content;
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Get existing cells for context
      const existingCells = notebook.cells
        .filter(c => c.cellType === 'code')
        .map(c => ({
          shortDescription: c.shortDescription,
          code: c.code,
        }));

      // Set up stream listener
      const removeListener = window.promptbook.ai.onGenerateCellsStream((event: GenerateCellsStreamEvent) => {
        if (event.type === 'content') {
          setStreamingContent(prev => prev + (event.content || ''));
        } else if (event.type === 'complete' && event.cells) {
          // Convert generated cell data to CellState and add to notebook
          const newCells: CellState[] = event.cells.map((cellData, index) => {
            const timestamp = Date.now() + index;
            if (cellData.cellType === 'text') {
              const textCell = createTextCell(`cell-gen-${timestamp}`);
              textCell.textContent = cellData.content || '';
              return textCell;
            } else {
              const codeCell = createCodeCell(`cell-gen-${timestamp}`);
              codeCell.shortDescription = cellData.instructions || '';
              codeCell.pseudoCode = cellData.detailed || '';
              codeCell.code = cellData.code || '';
              codeCell.lastEditedTab = 'code';
              return codeCell;
            }
          });
          // Append cells to the end of the notebook
          setNotebook(prev => ({
            ...prev,
            cells: [...prev.cells, ...newCells],
            metadata: { ...prev.metadata, modified: new Date().toISOString() },
          }));
          setProgress({ current: newCells.length, total: newCells.length });
          setIsGenerating(false);
          setIsModalOpen(false);
        } else if (event.type === 'error') {
          setError(event.error || 'Unknown error');
          setIsGenerating(false);
        }
      });

      cleanupRef.current = () => {
        removeListener();
        window.promptbook.ai.removeGenerateCellsListener();
      };

      // Invoke the IPC handler
      const result = await window.promptbook.ai.generateCells({
        description,
        fileContents,
        existingCells,
      });

      if (!result.success) {
        setError(result.error || 'Failed to generate cells');
        setIsGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsGenerating(false);
    }
  }, [isGenerating, projectId, notebook.cells, setNotebook]);

  return {
    isModalOpen,
    openModal,
    closeModal,
    isGenerating,
    streamingContent,
    progress,
    error,
    handleGenerate,
  };
}
