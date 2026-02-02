import { useState, useCallback, useEffect, useRef } from 'react';
import type { NotebookState, CellState } from '@promptbook/core';
import type { CellContext } from '@promptbook/core';
import { extractParams } from '../utils/paramUtils';

interface BackgroundSyncTask {
  cellId: string;
  code: string;
  previousCode?: string;
  existingShort?: string;
  existingPseudo?: string;
  cellsBefore: CellContext[];
  cellsAfter: CellContext[];
  timestamp: number;
}

export interface UseBackgroundSyncReturn {
  queueSync: (
    cellId: string,
    code: string,
    cellsBefore: CellContext[],
    cellsAfter: CellContext[],
    previousCode?: string,
    existingShort?: string,
    existingPseudo?: string
  ) => void;
  cancelSync: (cellId: string) => void;
  isPending: (cellId: string) => boolean;
}

interface UseBackgroundSyncParams {
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
}

export function useBackgroundSync({
  handleUpdate,
  setNotebook,
}: UseBackgroundSyncParams): UseBackgroundSyncReturn {
  const [queue, setQueue] = useState<BackgroundSyncTask[]>([]);
  const processingRef = useRef(false);
  const cancelledRef = useRef<Set<string>>(new Set());

  const queueSync = useCallback(
    (
      cellId: string,
      code: string,
      cellsBefore: CellContext[],
      cellsAfter: CellContext[],
      previousCode?: string,
      existingShort?: string,
      existingPseudo?: string
    ) => {
      // Remove any existing task for this cell (only keep latest)
      setQueue((prev) => {
        const filtered = prev.filter((t) => t.cellId !== cellId);
        return [
          ...filtered,
          {
            cellId,
            code,
            previousCode,
            existingShort,
            existingPseudo,
            cellsBefore,
            cellsAfter,
            timestamp: Date.now(),
          },
        ];
      });

      // Mark cell as syncing in background
      handleUpdate(cellId, {
        isSyncingInBackground: true,
        backgroundSyncError: undefined,
      });
    },
    [handleUpdate]
  );

  const cancelSync = useCallback((cellId: string) => {
    cancelledRef.current.add(cellId);
    setQueue((prev) => prev.filter((t) => t.cellId !== cellId));
  }, []);

  const isPending = useCallback(
    (cellId: string) => queue.some((t) => t.cellId === cellId),
    [queue]
  );

  // Process queue
  useEffect(() => {
    if (queue.length === 0 || processingRef.current) return;

    const processNext = async () => {
      processingRef.current = true;
      const task = queue[0];
      if (!task) {
        processingRef.current = false;
        return;
      }

      // Remove from queue
      setQueue((prev) => prev.slice(1));

      // Check if cancelled
      if (cancelledRef.current.has(task.cellId)) {
        cancelledRef.current.delete(task.cellId);
        processingRef.current = false;
        return;
      }

      try {
        // Sync code to short description (include previous code and existing description for diff-based update)
        const shortResult = await window.promptbook.ai.sync(
          task.cellId,
          'codeToShort',
          {
            newContent: task.code,
            previousContent: task.previousCode,
            existingCounterpart: task.existingShort,
            cellsBefore: task.cellsBefore,
            cellsAfter: task.cellsAfter,
          }
        );

        // Check if cancelled after first call
        if (cancelledRef.current.has(task.cellId)) {
          cancelledRef.current.delete(task.cellId);
          processingRef.current = false;
          return;
        }

        // Sync code to detailed instructions (include previous code and existing description for diff-based update)
        const pseudoResult = await window.promptbook.ai.sync(
          task.cellId,
          'codeToPseudo',
          {
            newContent: task.code,
            previousContent: task.previousCode,
            existingCounterpart: task.existingPseudo,
            cellsBefore: task.cellsBefore,
            cellsAfter: task.cellsAfter,
          }
        );

        // Check if cancelled after second call
        if (cancelledRef.current.has(task.cellId)) {
          cancelledRef.current.delete(task.cellId);
          processingRef.current = false;
          return;
        }

        // Update cell with new descriptions (keep code unchanged!)
        const newShort = shortResult.success
          ? shortResult.result || ''
          : undefined;
        const newPseudo = pseudoResult.success
          ? pseudoResult.result || ''
          : undefined;

        const updates: Partial<CellState> = {
          isSyncingInBackground: false,
          backgroundSyncError: undefined,
          lastBackgroundSyncTimestamp: Date.now(),
          isDirty: false,
        };

        if (newShort !== undefined) {
          updates.shortDescription = newShort;
          updates.lastSyncedShort = newShort;
        }
        if (newPseudo !== undefined) {
          updates.pseudoCode = newPseudo;
          updates.lastSyncedPseudo = newPseudo;
        }

        // Track synced params
        if (newShort || newPseudo) {
          updates.lastSyncedParams = {
            ...extractParams(newShort || ''),
            ...extractParams(newPseudo || ''),
          };
        }

        // Code stays as user wrote it - just mark it as synced
        updates.lastSyncedCode = task.code;

        handleUpdate(task.cellId, updates);

        // Update notebook symbols if available
        if (shortResult.notebookSymbols || pseudoResult.notebookSymbols) {
          const symbols =
            shortResult.notebookSymbols || pseudoResult.notebookSymbols;
          if (symbols && symbols.length > 0) {
            setNotebook((prev) => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                symbols,
                symbolsLastUpdated: new Date().toISOString(),
              },
            }));
          }
        }
      } catch (error) {
        handleUpdate(task.cellId, {
          isSyncingInBackground: false,
          backgroundSyncError: String(error),
        });
      }

      processingRef.current = false;
    };

    processNext();
  }, [queue, handleUpdate, setNotebook]);

  return { queueSync, cancelSync, isPending };
}
