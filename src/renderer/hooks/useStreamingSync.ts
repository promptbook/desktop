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
  const syncingCellsRef = useRef<Set<string>>(new Set());
  const cancelledRef = useRef<Set<string>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const streamingThinkingRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
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
      // Prevent duplicate sync calls
      if (syncingCellsRef.current.has(cellId)) return;

      syncingCellsRef.current.add(cellId);
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

      let resolveCompletion: ((result: StreamingSyncResult) => void) | null = null;
      const completionPromise = options?.waitForCompletion
        ? new Promise<StreamingSyncResult>((resolve) => { resolveCompletion = resolve; })
        : null;

      const removeListener = window.promptbook.ai.onSyncStreamEvent((event: SyncStreamEvent) => {
        if (event.cellId !== cellId) return;

        if (cancelledRef.current.has(cellId)) {
          cancelledRef.current.delete(cellId);
          return;
        }

        if (event.type === 'content' && event.content) {
          const current = streamingContentRef.current.get(cellId) || '';
          const newContent = current + event.content;
          streamingContentRef.current.set(cellId, newContent);
          handleUpdate(cellId, { streamingContent: newContent });
        }

        if (event.type === 'thinking' && event.content) {
          const current = streamingThinkingRef.current.get(cellId) || '';
          const newThinking = current + event.content;
          streamingThinkingRef.current.set(cellId, newThinking);
          handleUpdate(cellId, { streamingThinking: newThinking });
        }

        if (event.type === 'complete' && event.result) {
          try {
            const results: AlignedSyncResults = JSON.parse(event.result.content);
            const finalThinking = streamingThinkingRef.current.get(cellId);
            const finalContent = streamingContentRef.current.get(cellId);

            const updates: Partial<CellState> = {
              isSyncing: false,
              syncStartTime: undefined,
              isDirty: false,
              lastBackgroundSyncTimestamp: Date.now(),
              streamingContent: undefined,
              streamingThinking: undefined,
              lastSyncThinking: finalThinking,
              lastSyncResponse: event.result.rawResponse || finalContent,
              lastSyncTimestamp: Date.now(),
            };

            streamingContentRef.current.delete(cellId);
            streamingThinkingRef.current.delete(cellId);

            if (sourceType === 'code') {
              updates.shortDescription = results.instructions;
              updates.pseudoCode = results.detailed;
              updates.lastSyncedCode = sourceContent;
            } else {
              updates.shortDescription = results.instructions;
              updates.pseudoCode = results.detailed;
              updates.code = results.code;
              updates.lastSyncedCode = results.code;
            }

            updates.lastSyncedShort = results.instructions;
            updates.lastSyncedPseudo = results.detailed;
            updates.lastSyncedParams = {
              ...extractParams(results.instructions || ''),
              ...extractParams(results.detailed || ''),
            };

            handleUpdate(cellId, updates);
            if (resolveCompletion) {
              resolveCompletion({ success: true, instructions: results.instructions, detailed: results.detailed, code: results.code });
            }
          } catch (e) {
            handleUpdate(cellId, { isSyncing: false, syncStartTime: undefined, backgroundSyncError: `Failed to parse sync results: ${e}` });
            if (resolveCompletion) resolveCompletion({ success: false, error: `Failed to parse sync results: ${e}` });
          }

          syncingCellsRef.current.delete(cellId);
          setSyncingCells((prev) => { const next = new Set(prev); next.delete(cellId); return next; });
          removeListener();
        }

        if (event.type === 'error') {
          handleUpdate(cellId, { isSyncing: false, syncStartTime: undefined, backgroundSyncError: event.error || 'Unknown error during sync' });
          if (resolveCompletion) resolveCompletion({ success: false, error: event.error || 'Unknown error during sync' });
          syncingCellsRef.current.delete(cellId);
          setSyncingCells((prev) => { const next = new Set(prev); next.delete(cellId); return next; });
          removeListener();
        }
      });

      cleanupRef.current = removeListener;

      try {
        await window.promptbook.ai.syncStream({
          cellId, sourceType, sourceContent, cellsBefore, cellsAfter, existingParameters,
          notebookSymbols: options?.notebookSymbols,
          existingInstructions: options?.existingInstructions,
          existingDetailed: options?.existingDetailed,
          existingCode: options?.existingCode,
        });
      } catch (error) {
        handleUpdate(cellId, { isSyncing: false, syncStartTime: undefined, backgroundSyncError: `Sync failed: ${error}` });
        syncingCellsRef.current.delete(cellId);
        setSyncingCells((prev) => { const next = new Set(prev); next.delete(cellId); return next; });
        removeListener();
        if (resolveCompletion) resolveCompletion({ success: false, error: `Sync failed: ${error}` });
      }

      if (completionPromise) return completionPromise;
    },
    [handleUpdate]
  );

  const cancelSync = useCallback((cellId: string) => {
    cancelledRef.current.add(cellId);
    syncingCellsRef.current.delete(cellId);
    setSyncingCells((prev) => { const next = new Set(prev); next.delete(cellId); return next; });
    handleUpdate(cellId, { isSyncing: false, syncStartTime: undefined });
  }, [handleUpdate]);

  const isSyncing = useCallback((cellId: string) => syncingCells.has(cellId), [syncingCells]);

  return { startStreamingSync, cancelSync, isSyncing };
}
