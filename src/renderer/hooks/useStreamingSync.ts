import { useState, useCallback, useEffect, useRef } from 'react';
import type { CellState } from '@promptbook/core';
import type { CellContext } from '../types';
import type { SyncSourceType, SyncStreamEvent, AlignedSyncResults } from '../types';
import { extractParams } from '../utils/paramUtils';

export interface UseStreamingSyncParams {
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
}

export interface UseStreamingSyncReturn {
  startStreamingSync: (
    cellId: string,
    sourceType: SyncSourceType,
    sourceContent: string,
    cellsBefore: CellContext[],
    cellsAfter: CellContext[],
    existingParameters: Record<string, string>,
    options?: {
      notebookSymbols?: string[];
      existingInstructions?: string;
      existingDetailed?: string;
      existingCode?: string;
    }
  ) => Promise<void>;
  cancelSync: (cellId: string) => void;
  isSyncing: (cellId: string) => boolean;
}

export function useStreamingSync({
  handleUpdate,
}: UseStreamingSyncParams): UseStreamingSyncReturn {
  const [syncingCells, setSyncingCells] = useState<Set<string>>(new Set());
  const cancelledRef = useRef<Set<string>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const startStreamingSync = useCallback(
    async (
      cellId: string,
      sourceType: SyncSourceType,
      sourceContent: string,
      cellsBefore: CellContext[],
      cellsAfter: CellContext[],
      existingParameters: Record<string, string>,
      options?: {
        notebookSymbols?: string[];
        existingInstructions?: string;
        existingDetailed?: string;
        existingCode?: string;
      }
    ) => {
      // Mark cell as syncing
      setSyncingCells((prev) => new Set(prev).add(cellId));
      handleUpdate(cellId, {
        isSyncing: true,
        syncStartTime: Date.now(),
        backgroundSyncError: undefined,
      });

      // Set up stream listener
      const removeListener = window.promptbook.ai.onSyncStreamEvent(
        (event: SyncStreamEvent) => {
          // Only handle events for this cell
          if (event.cellId !== cellId) return;

          // Check if cancelled
          if (cancelledRef.current.has(cellId)) {
            cancelledRef.current.delete(cellId);
            return;
          }

          if (event.type === 'content' || event.type === 'thinking') {
            // Could update streaming content display here
            // For now, just let the UI show the syncing indicator
          }

          if (event.type === 'complete' && event.result) {
            try {
              // Parse the aligned results from the orchestrator
              const results: AlignedSyncResults = JSON.parse(event.result.content);

              // Build updates based on source type
              const updates: Partial<CellState> = {
                isSyncing: false,
                syncStartTime: undefined,
                isDirty: false,
                lastBackgroundSyncTimestamp: Date.now(),
              };

              // Update all three tabs with aligned content
              // But if source was code, keep the user's code intact
              if (sourceType === 'code') {
                updates.shortDescription = results.instructions;
                updates.pseudoCode = results.detailed;
                // Code stays as user wrote it
                updates.lastSyncedCode = sourceContent;
              } else {
                updates.shortDescription = results.instructions;
                updates.pseudoCode = results.detailed;
                updates.code = results.code;
                updates.lastSyncedCode = results.code;
              }

              // Track synced descriptions
              updates.lastSyncedShort = results.instructions;
              updates.lastSyncedPseudo = results.detailed;

              // Extract and track parameters
              updates.lastSyncedParams = {
                ...extractParams(results.instructions || ''),
                ...extractParams(results.detailed || ''),
              };

              handleUpdate(cellId, updates);
            } catch (e) {
              console.error('[StreamingSync] Failed to parse results:', e);
              handleUpdate(cellId, {
                isSyncing: false,
                syncStartTime: undefined,
                backgroundSyncError: `Failed to parse sync results: ${e}`,
              });
            }

            // Clean up
            setSyncingCells((prev) => {
              const next = new Set(prev);
              next.delete(cellId);
              return next;
            });
            removeListener();
          }

          if (event.type === 'error') {
            handleUpdate(cellId, {
              isSyncing: false,
              syncStartTime: undefined,
              backgroundSyncError: event.error || 'Unknown error during sync',
            });

            setSyncingCells((prev) => {
              const next = new Set(prev);
              next.delete(cellId);
              return next;
            });
            removeListener();
          }
        }
      );

      cleanupRef.current = removeListener;

      // Start the streaming sync
      try {
        await window.promptbook.ai.syncStream({
          cellId,
          sourceType,
          sourceContent,
          cellsBefore,
          cellsAfter,
          existingParameters,
          notebookSymbols: options?.notebookSymbols,
          existingInstructions: options?.existingInstructions,
          existingDetailed: options?.existingDetailed,
          existingCode: options?.existingCode,
        });
      } catch (error) {
        // IPC call itself failed
        handleUpdate(cellId, {
          isSyncing: false,
          syncStartTime: undefined,
          backgroundSyncError: `Sync failed: ${error}`,
        });
        setSyncingCells((prev) => {
          const next = new Set(prev);
          next.delete(cellId);
          return next;
        });
        removeListener();
      }
    },
    [handleUpdate]
  );

  const cancelSync = useCallback((cellId: string) => {
    cancelledRef.current.add(cellId);
    setSyncingCells((prev) => {
      const next = new Set(prev);
      next.delete(cellId);
      return next;
    });
    handleUpdate(cellId, {
      isSyncing: false,
      syncStartTime: undefined,
    });
  }, [handleUpdate]);

  const isSyncing = useCallback(
    (cellId: string) => syncingCells.has(cellId),
    [syncingCells]
  );

  return { startStreamingSync, cancelSync, isSyncing };
}
