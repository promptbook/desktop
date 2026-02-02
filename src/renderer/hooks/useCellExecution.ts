import { useCallback } from 'react';
import type { NotebookState, CellState } from '@promptbook/core';
import type { CellContext } from '@promptbook/core';
import {
  extractParams,
  getParamChanges,
  applyParamChangesToCode,
  applyParamChangesToDescription,
} from '../utils/paramUtils';
import type { UseBackgroundSyncReturn } from './useBackgroundSync';
import type { UseStreamingSyncReturn } from './useStreamingSync';
import {
  PackageInstallModalState,
  syncCellWithAI,
  generateCodeFromDescription,
  executeCode,
  syncFromCode,
  syncFromShort,
  syncFromPseudo,
} from './cellSyncHelpers';

// Re-export for backwards compatibility
export type { PackageInstallModalState } from './cellSyncHelpers';

interface UseCellExecutionParams {
  notebook: NotebookState;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>;
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  handleSaveVersion: (message: string) => Promise<void>;
  onError: (error: string) => void;
  setEnvironmentPickerOpen: (open: boolean) => void;
  setPackageInstallModal: React.Dispatch<React.SetStateAction<PackageInstallModalState>>;
  setPackageInstallError: (error: string | null) => void;
  backgroundSync?: UseBackgroundSyncReturn;
  streamingSync?: UseStreamingSyncReturn;
}

export function useCellExecution({
  notebook,
  setNotebook,
  handleUpdate,
  handleSaveVersion,
  onError,
  setEnvironmentPickerOpen,
  setPackageInstallModal,
  setPackageInstallError,
  backgroundSync,
  streamingSync,
}: UseCellExecutionParams) {
  const handleRunCell = useCallback(
    async (cellId: string) => {
      const cellIndex = notebook.cells.findIndex((c) => c.id === cellId);
      let cell = notebook.cells[cellIndex];
      if (!cell || cell.cellType === 'text') return;

      // Check if we have a kernel
      const status = await window.promptbook.kernel.getStatus();
      if (status.state === 'disconnected' || status.state === 'dead') {
        setEnvironmentPickerOpen(true);
        return;
      }

      // Gather context from surrounding cells
      const cellsBefore = notebook.cells
        .slice(0, cellIndex)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));
      const cellsAfter = notebook.cells
        .slice(cellIndex + 1)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));

      const hasDescription = cell.shortDescription?.trim() || cell.pseudoCode?.trim();
      const hasCode = cell.code?.trim();
      const lastEditedTab = cell.lastEditedTab || 'short';

      // Handle dirty cell with parameter-only changes (skip LLM, update code directly)
      if (cell.isDirty && hasDescription && hasCode) {
        const currentParams = {
          ...extractParams(cell.shortDescription || ''),
          ...extractParams(cell.pseudoCode || ''),
        };

        if (cell.lastSyncedParams) {
          const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

          // If ONLY parameter values changed, apply directly without LLM
          if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
            const newCode = applyParamChangesToCode(cell.code, changed);
            const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
            const newFull = applyParamChangesToDescription(cell.pseudoCode || '', changed);

            handleUpdate(cellId, {
              code: newCode, shortDescription: newShort, pseudoCode: newFull,
              lastSyncedCode: newCode, lastSyncedShort: newShort, lastSyncedPseudo: newFull,
              lastSyncedParams: currentParams, isDirty: false,
            });

            cell = { ...cell, code: newCode, shortDescription: newShort, pseudoCode: newFull, isDirty: false };
            await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);
            return;
          }
        }
      }

      // FEATURE 1: If user edited CODE tab, run immediately and sync in background
      if (cell.isDirty && lastEditedTab === 'code' && hasCode) {
        await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);

        if (streamingSync) {
          const existingParameters = {
            ...extractParams(cell.shortDescription || ''),
            ...extractParams(cell.pseudoCode || ''),
          };
          streamingSync.startStreamingSync(cellId, 'code', cell.code, cellsBefore, cellsAfter, existingParameters, {
            existingInstructions: cell.shortDescription, existingDetailed: cell.pseudoCode, existingCode: cell.code,
          });
        } else if (backgroundSync) {
          backgroundSync.queueSync(cellId, cell.code, cellsBefore, cellsAfter, cell.lastSyncedCode, cell.shortDescription, cell.pseudoCode);
        }
        return;
      }

      // Sync with AI if still dirty (use streaming sync if available)
      if (cell.isDirty && hasDescription && !cell.isSyncing) {
        if (streamingSync) {
          const sourceType = lastEditedTab === 'short' ? 'instructions' : lastEditedTab === 'pseudo' ? 'detailed' : 'code';
          const sourceContent = lastEditedTab === 'code' ? cell.code : lastEditedTab === 'short' ? cell.shortDescription : cell.pseudoCode;
          const existingParameters = { ...extractParams(cell.shortDescription || ''), ...extractParams(cell.pseudoCode || '') };

          const result = await streamingSync.startStreamingSync(
            cellId, sourceType as 'instructions' | 'detailed' | 'code', sourceContent || '',
            cellsBefore, cellsAfter, existingParameters,
            { existingInstructions: cell.shortDescription, existingDetailed: cell.pseudoCode, existingCode: cell.code, waitForCompletion: true }
          );

          if (!result?.success) {
            onError(result?.error || 'Sync failed');
            return;
          }

          cell = {
            ...cell, shortDescription: result.instructions || cell.shortDescription,
            pseudoCode: result.detailed || cell.pseudoCode, code: result.code || cell.code, isDirty: false,
          };
        } else {
          cell = await syncCellWithAI(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError, setNotebook);
          if (!cell) return;
        }
      }

      // Generate code if only description exists (no code yet)
      if (hasDescription && !cell.code?.trim()) {
        if (streamingSync) {
          const sourceType = cell.pseudoCode?.trim() ? 'detailed' : 'instructions';
          const sourceContent = cell.pseudoCode?.trim() || cell.shortDescription || '';
          const existingParameters = { ...extractParams(cell.shortDescription || ''), ...extractParams(cell.pseudoCode || '') };

          const result = await streamingSync.startStreamingSync(
            cellId, sourceType, sourceContent, cellsBefore, cellsAfter, existingParameters,
            { existingInstructions: cell.shortDescription, existingDetailed: cell.pseudoCode, waitForCompletion: true }
          );

          if (!result?.success) {
            onError(result?.error || 'Code generation failed');
            return;
          }

          cell = {
            ...cell, shortDescription: result.instructions || cell.shortDescription,
            pseudoCode: result.detailed || cell.pseudoCode, code: result.code || '', isDirty: false,
          };
        } else {
          cell = await generateCodeFromDescription(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError, setNotebook);
          if (!cell) return;
        }
      }

      await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);
    },
    [notebook.cells, setNotebook, handleUpdate, handleSaveVersion, onError, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError, backgroundSync, streamingSync]
  );

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cellIndex = notebook.cells.findIndex((c) => c.id === cellId);
      const cell = notebook.cells[cellIndex];
      if (!cell || cell.cellType === 'text') return;

      if (cell.isSyncing) return;

      const hasDescription = cell.shortDescription?.trim() || cell.pseudoCode?.trim();
      const hasCode = cell.code?.trim();

      // Check for param-only changes first
      if (hasDescription && hasCode && cell.lastSyncedParams) {
        const currentParams = { ...extractParams(cell.shortDescription || ''), ...extractParams(cell.pseudoCode || '') };
        const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

        if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
          const newCode = applyParamChangesToCode(cell.code, changed);
          const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
          const newFull = applyParamChangesToDescription(cell.pseudoCode || '', changed);

          handleUpdate(cellId, {
            code: newCode, shortDescription: newShort, pseudoCode: newFull,
            lastSyncedCode: newCode, lastSyncedShort: newShort, lastSyncedPseudo: newFull,
            lastSyncedParams: currentParams, isDirty: false,
          });
          return;
        }
      }

      const cellsBefore: CellContext[] = notebook.cells.slice(0, cellIndex).filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));
      const cellsAfter: CellContext[] = notebook.cells.slice(cellIndex + 1).filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));

      const lastEdited = cell.lastEditedTab || 'short';

      if (streamingSync) {
        const sourceType = lastEdited === 'short' ? 'instructions' : lastEdited === 'pseudo' ? 'detailed' : 'code';
        const sourceContent = lastEdited === 'code' ? cell.code : lastEdited === 'short' ? cell.shortDescription : cell.pseudoCode;
        const existingParameters = { ...extractParams(cell.shortDescription || ''), ...extractParams(cell.pseudoCode || '') };

        const kernelSymbolsResult = await window.promptbook.kernel.getSymbols?.().catch(() => ({ symbols: [] }));
        const notebookSymbols = kernelSymbolsResult?.symbols?.map(s => s.name) || [];

        await streamingSync.startStreamingSync(cellId, sourceType, sourceContent || '', cellsBefore, cellsAfter, existingParameters, {
          notebookSymbols, existingInstructions: cell.shortDescription, existingDetailed: cell.pseudoCode, existingCode: cell.code,
        });
        return;
      }

      // Fallback to legacy sync
      handleUpdate(cellId, { isSyncing: true, syncStartTime: Date.now() });

      try {
        if (lastEdited === 'code') {
          await syncFromCode(cellId, cell, handleUpdate);
        } else if (lastEdited === 'short') {
          await syncFromShort(cellId, cell, cellsBefore, cellsAfter, handleUpdate, setNotebook);
        } else {
          await syncFromPseudo(cellId, cell, cellsBefore, cellsAfter, handleUpdate, setNotebook);
        }
      } catch (error) {
        handleUpdate(cellId, { isSyncing: false });
        onError(String(error));
      }
    },
    [notebook.cells, handleUpdate, onError, setNotebook, streamingSync]
  );

  return { handleRunCell, handleSyncCell };
}
