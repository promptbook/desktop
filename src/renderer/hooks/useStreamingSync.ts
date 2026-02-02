import { useState, useCallback, useEffect, useRef } from 'react';
import type { CellState } from '@promptbook/core';
import type { CellContext } from '../types';
import type { SyncSourceType, SyncStreamEvent, AlignedSyncResults } from '../types';
import { extractParams } from '../utils/paramUtils';

export interface UseStreamingSyncParams {
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
}

export interface StreamingSyncResult {
  success: boolean;
  instructions?: string;
  detailed?: string;
  code?: string;
  error?: string;
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
      waitForCompletion?: boolean;
    }
  ) => Promise<StreamingSyncResult | void>;
  cancelSync: (cellId: string) => void;
  isSyncing: (cellId: string) => boolean;
}

export function useStreamingSync({
  handleUpdate,
}: UseStreamingSyncParams): UseStreamingSyncReturn {
  const [syncingCells, setSyncingCells] = useState<Set<string>>(new Set());
  const cancelledRef = useRef<Set<string>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);
  // Track accumulated streaming content per cell
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const streamingThinkingRef = useRef<Map<string, string>>(new Map());

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
        waitForCompletion?: boolean;
      }
    ): Promise<StreamingSyncResult | void> => {
      console.log('[StreamingSync] Starting sync for cell:', cellId, 'sourceType:', sourceType, 'waitForCompletion:', options?.waitForCompletion);
      console.log('[StreamingSync] Source content length:', sourceContent?.length);

      // Mark cell as syncing and clear previous streaming content
      setSyncingCells((prev) => new Set(prev).add(cellId));
      streamingContentRef.current.delete(cellId);
      streamingThinkingRef.current.delete(cellId);
      handleUpdate(cellId, {
        isSyncing: true,
        syncStartTime: Date.now(),
        backgroundSyncError: undefined,
        streamingContent: undefined,
        streamingThinking: undefined,
      });

      // If waiting for completion, create a promise that resolves when done
      let resolveCompletion: ((result: StreamingSyncResult) => void) | null = null;
      const completionPromise = options?.waitForCompletion
        ? new Promise<StreamingSyncResult>((resolve) => {
            resolveCompletion = resolve;
          })
        : null;

      // Set up stream listener
      console.log('[StreamingSync] Setting up stream listener for cell:', cellId);
      const removeListener = window.promptbook.ai.onSyncStreamEvent(
        (event: SyncStreamEvent) => {
          console.log('[StreamingSync] Received event:', event.type, 'for cell:', event.cellId);

          // Only handle events for this cell
          if (event.cellId !== cellId) return;

          // Check if cancelled
          if (cancelledRef.current.has(cellId)) {
            console.log('[StreamingSync] Sync was cancelled for cell:', cellId);
            cancelledRef.current.delete(cellId);
            return;
          }

          if (event.type === 'content' && event.content) {
            // Accumulate streaming content
            const current = streamingContentRef.current.get(cellId) || '';
            const newContent = current + event.content;
            streamingContentRef.current.set(cellId, newContent);

            // Update cell state with streaming content
            handleUpdate(cellId, {
              streamingContent: newContent,
            });
            console.log('[StreamingSync] Content chunk received, total length:', newContent.length);
          }

          if (event.type === 'thinking' && event.content) {
            // Accumulate thinking content
            const current = streamingThinkingRef.current.get(cellId) || '';
            const newThinking = current + event.content;
            streamingThinkingRef.current.set(cellId, newThinking);

            // Update cell state with thinking content
            handleUpdate(cellId, {
              streamingThinking: newThinking,
            });
            console.log('[StreamingSync] Thinking chunk received, total length:', newThinking.length);
          }

          if (event.type === 'complete' && event.result) {
            console.log('[StreamingSync] Complete event received');
            console.log('[StreamingSync] Raw result:', event.result);
            try {
              // Parse the aligned results from the orchestrator
              const results: AlignedSyncResults = JSON.parse(event.result.content);
              console.log('[StreamingSync] Parsed results:', results);

              // Build updates based on source type
              const updates: Partial<CellState> = {
                isSyncing: false,
                syncStartTime: undefined,
                isDirty: false,
                lastBackgroundSyncTimestamp: Date.now(),
                streamingContent: undefined,
                streamingThinking: undefined,
              };

              // Clean up streaming refs
              streamingContentRef.current.delete(cellId);
              streamingThinkingRef.current.delete(cellId);

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

              // Resolve completion promise if waiting
              if (resolveCompletion) {
                resolveCompletion({
                  success: true,
                  instructions: results.instructions,
                  detailed: results.detailed,
                  code: results.code,
                });
              }
            } catch (e) {
              console.error('[StreamingSync] Failed to parse results:', e);
              handleUpdate(cellId, {
                isSyncing: false,
                syncStartTime: undefined,
                backgroundSyncError: `Failed to parse sync results: ${e}`,
              });

              // Resolve with error if waiting
              if (resolveCompletion) {
                resolveCompletion({
                  success: false,
                  error: `Failed to parse sync results: ${e}`,
                });
              }
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
            console.error('[StreamingSync] Error event received:', event.error);
            handleUpdate(cellId, {
              isSyncing: false,
              syncStartTime: undefined,
              backgroundSyncError: event.error || 'Unknown error during sync',
            });

            // Resolve with error if waiting
            if (resolveCompletion) {
              resolveCompletion({
                success: false,
                error: event.error || 'Unknown error during sync',
              });
            }

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
      console.log('[StreamingSync] Calling IPC syncStream...');
      try {
        const result = await window.promptbook.ai.syncStream({
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
        console.log('[StreamingSync] IPC syncStream returned:', result);
      } catch (error) {
        // IPC call itself failed
        console.error('[StreamingSync] IPC call failed:', error);
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

        // Resolve with error if waiting
        if (resolveCompletion) {
          resolveCompletion({
            success: false,
            error: `Sync failed: ${error}`,
          });
        }
      }

      // If waiting for completion, return the promise
      if (completionPromise) {
        return completionPromise;
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
