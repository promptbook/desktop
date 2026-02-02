import { useCallback } from 'react';
import type {
  NotebookState,
  CellState,
  CellOutput,
} from '@promptbook/core';
import type { GeneratedSymbol, CellContext } from '@promptbook/core';
import { detectMissingPackages, MissingPackage } from '@promptbook/core';
import {
  extractParams,
  getParamChanges,
  applyParamChangesToCode,
  applyParamChangesToDescription,
} from '../utils/paramUtils';
import type { UseBackgroundSyncReturn } from './useBackgroundSync';
import type { UseStreamingSyncReturn } from './useStreamingSync';

export interface PackageInstallModalState {
  isOpen: boolean;
  packages: MissingPackage[];
  cellId: string;
}

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

/** Helper to update notebook symbols from LLM response */
function updateNotebookSymbols(
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>,
  symbols: GeneratedSymbol[]
): void {
  if (!symbols || symbols.length === 0) return;
  setNotebook(prev => ({
    ...prev,
    metadata: {
      ...prev.metadata,
      symbols,
      symbolsLastUpdated: new Date().toISOString(),
    },
  }));
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
        const currentShortParams = extractParams(cell.shortDescription || '');
        const currentFullParams = extractParams(cell.pseudoCode || '');
        const currentParams = { ...currentShortParams, ...currentFullParams };

        if (cell.lastSyncedParams) {
          const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

          // If ONLY parameter values changed (no structural changes), apply directly without LLM
          if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
            const newCode = applyParamChangesToCode(cell.code, changed);
            const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
            const newFull = applyParamChangesToDescription(cell.pseudoCode || '', changed);

            handleUpdate(cellId, {
              code: newCode,
              shortDescription: newShort,
              pseudoCode: newFull,
              lastSyncedCode: newCode,
              lastSyncedShort: newShort,
              lastSyncedPseudo: newFull,
              lastSyncedParams: currentParams,
              isDirty: false,
            });

            // Update local cell and execute immediately (no LLM call needed)
            cell = { ...cell, code: newCode, shortDescription: newShort, pseudoCode: newFull, isDirty: false };
            await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);
            return;
          }
        }
      }

      // FEATURE 1: If user edited CODE tab, run immediately and sync in background
      if (cell.isDirty && lastEditedTab === 'code' && hasCode) {
        // Execute immediately without waiting for sync
        await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);

        // Use streaming sync if available, otherwise fall back to background sync
        if (streamingSync) {
          // Extract existing parameters
          const existingParameters = {
            ...extractParams(cell.shortDescription || ''),
            ...extractParams(cell.pseudoCode || ''),
          };

          // Start streaming sync in background (code is preserved, only generates instructions/detailed)
          streamingSync.startStreamingSync(
            cellId,
            'code',
            cell.code,
            cellsBefore,
            cellsAfter,
            existingParameters,
            {
              existingInstructions: cell.shortDescription,
              existingDetailed: cell.pseudoCode,
              existingCode: cell.code,
            }
          );
        } else if (backgroundSync) {
          // Legacy: Queue background sync to regenerate Instructions and Detailed tabs
          backgroundSync.queueSync(
            cellId,
            cell.code,
            cellsBefore,
            cellsAfter,
            cell.lastSyncedCode,
            cell.shortDescription,
            cell.pseudoCode
          );
        }
        return;
      }

      // Original behavior for non-code edits: Sync with AI if still dirty
      if (cell.isDirty && hasDescription) {
        cell = await syncCellWithAI(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError, setNotebook);
        if (!cell) return;
      }

      // Generate code if only description exists (no code yet)
      if (hasDescription && !hasCode) {
        cell = await generateCodeFromDescription(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError, setNotebook);
        if (!cell) return;
      }

      // Execute the code
      await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);
    },
    [notebook.cells, setNotebook, handleUpdate, handleSaveVersion, onError, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError, backgroundSync, streamingSync]
  );

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cellIndex = notebook.cells.findIndex((c) => c.id === cellId);
      const cell = notebook.cells[cellIndex];
      if (!cell || cell.cellType === 'text') return;

      // Check for param-only changes first (skip LLM if only params changed)
      const hasDescription = cell.shortDescription?.trim() || cell.pseudoCode?.trim();
      const hasCode = cell.code?.trim();

      if (hasDescription && hasCode && cell.lastSyncedParams) {
        const currentShortParams = extractParams(cell.shortDescription || '');
        const currentFullParams = extractParams(cell.pseudoCode || '');
        const currentParams = { ...currentShortParams, ...currentFullParams };
        const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

        // If ONLY parameter values changed, apply directly without LLM
        if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
          const newCode = applyParamChangesToCode(cell.code, changed);
          const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
          const newFull = applyParamChangesToDescription(cell.pseudoCode || '', changed);

          handleUpdate(cellId, {
            code: newCode,
            shortDescription: newShort,
            pseudoCode: newFull,
            lastSyncedCode: newCode,
            lastSyncedShort: newShort,
            lastSyncedPseudo: newFull,
            lastSyncedParams: currentParams,
            isDirty: false,
          });
          return; // No LLM call needed
        }
      }

      const cellsBefore: CellContext[] = notebook.cells
        .slice(0, cellIndex)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));
      const cellsAfter: CellContext[] = notebook.cells
        .slice(cellIndex + 1)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));

      const lastEdited = cell.lastEditedTab || 'short';

      // Use new streaming sync if available
      if (streamingSync) {
        // Map tab name to source type
        const sourceType = lastEdited === 'short' ? 'instructions' : lastEdited === 'pseudo' ? 'detailed' : 'code';
        const sourceContent = lastEdited === 'code' ? cell.code : lastEdited === 'short' ? cell.shortDescription : cell.pseudoCode;

        // Extract existing parameters from all tabs
        const existingParameters = {
          ...extractParams(cell.shortDescription || ''),
          ...extractParams(cell.pseudoCode || ''),
        };

        // Get kernel symbols if available
        const kernelSymbolsResult = await window.promptbook.kernel.getSymbols?.().catch(() => ({ symbols: [] }));
        const notebookSymbols = kernelSymbolsResult?.symbols?.map(s => s.name) || [];

        await streamingSync.startStreamingSync(
          cellId,
          sourceType,
          sourceContent || '',
          cellsBefore,
          cellsAfter,
          existingParameters,
          {
            notebookSymbols,
            existingInstructions: cell.shortDescription,
            existingDetailed: cell.pseudoCode,
            existingCode: cell.code,
          }
        );
        return;
      }

      // Fallback to legacy sync if streaming sync not available
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

// Helper: Sync cell with AI when dirty
async function syncCellWithAI(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void,
  handleSaveVersion: (message: string) => Promise<void>,
  onError: (error: string) => void,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): Promise<CellState | null> {
  handleUpdate(cellId, { isSyncing: true, syncStartTime: Date.now() });
  try {
    const description = cell.pseudoCode?.trim() || cell.shortDescription?.trim();
    const syncResult = await window.promptbook.ai.sync(cellId, 'pseudoToCode', {
      newContent: description || '',
      previousContent: cell.lastSyncedPseudo,
      existingCounterpart: cell.code,
      cellsBefore,
      cellsAfter,
    });

    if (syncResult.success && syncResult.result) {
      const generatedCode = syncResult.result;

      // Update notebook symbols from LLM response
      if (syncResult.notebookSymbols) {
        updateNotebookSymbols(setNotebook, syncResult.notebookSymbols);
      }

      const [shortResult, fullResult] = await Promise.all([
        window.promptbook.ai.sync(cellId, 'codeToShort', {
          newContent: generatedCode,
          existingCounterpart: cell.shortDescription,
        }),
        window.promptbook.ai.sync(cellId, 'codeToPseudo', {
          newContent: generatedCode,
          existingCounterpart: cell.pseudoCode,
        }),
      ]);

      const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
      const newFull = fullResult.success ? fullResult.result || cell.pseudoCode : cell.pseudoCode;
      const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

      handleUpdate(cellId, {
        code: generatedCode,
        shortDescription: newShort,
        pseudoCode: newFull,
        lastSyncedCode: generatedCode,
        lastSyncedShort: newShort,
        lastSyncedPseudo: newFull,
        lastSyncedParams: syncedParams,
        isDirty: false,
        isSyncing: false, syncStartTime: undefined,
      });
      handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
      return { ...cell, code: generatedCode, shortDescription: newShort, pseudoCode: newFull };
    } else {
      handleUpdate(cellId, { isSyncing: false });
      if (syncResult.error) onError(syncResult.error);
      return null;
    }
  } catch (error) {
    handleUpdate(cellId, { isSyncing: false });
    onError(String(error));
    return null;
  }
}

// Helper: Generate code from description
async function generateCodeFromDescription(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void,
  handleSaveVersion: (message: string) => Promise<void>,
  onError: (error: string) => void,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): Promise<CellState | null> {
  handleUpdate(cellId, { isSyncing: true, syncStartTime: Date.now() });
  try {
    const description = cell.pseudoCode?.trim() || cell.shortDescription?.trim();
    const syncResult = await window.promptbook.ai.sync(cellId, 'pseudoToCode', {
      newContent: description || '',
      existingCounterpart: cell.code,
      cellsBefore,
      cellsAfter,
    });

    if (syncResult.success && syncResult.result) {
      const generatedCode = syncResult.result;

      // Update notebook symbols from LLM response
      if (syncResult.notebookSymbols) {
        updateNotebookSymbols(setNotebook, syncResult.notebookSymbols);
      }

      const [shortResult, fullResult] = await Promise.all([
        window.promptbook.ai.sync(cellId, 'codeToShort', {
          newContent: generatedCode,
          existingCounterpart: cell.shortDescription,
        }),
        window.promptbook.ai.sync(cellId, 'codeToPseudo', {
          newContent: generatedCode,
          existingCounterpart: cell.pseudoCode,
        }),
      ]);

      const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
      const newFull = fullResult.success ? fullResult.result || cell.pseudoCode : cell.pseudoCode;
      const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

      handleUpdate(cellId, {
        code: generatedCode,
        shortDescription: newShort,
        pseudoCode: newFull,
        lastSyncedCode: generatedCode,
        lastSyncedShort: newShort,
        lastSyncedPseudo: newFull,
        lastSyncedParams: syncedParams,
        isDirty: false,
        isSyncing: false, syncStartTime: undefined,
      });
      handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
      return { ...cell, code: generatedCode, shortDescription: newShort, pseudoCode: newFull };
    } else {
      handleUpdate(cellId, { isSyncing: false });
      if (syncResult.error) onError(syncResult.error);
      return null;
    }
  } catch (error) {
    handleUpdate(cellId, { isSyncing: false });
    onError(String(error));
    return null;
  }
}

// Helper: Execute code in kernel
async function executeCode(
  cellId: string,
  cell: CellState,
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void,
  setEnvironmentPickerOpen: (open: boolean) => void,
  setPackageInstallModal: React.Dispatch<React.SetStateAction<PackageInstallModalState>>,
  setPackageInstallError: (error: string | null) => void
): Promise<void> {
  const startTime = Date.now();
  const executionCount = (cell.executionCount || 0) + 1;
  handleUpdate(cellId, {
    isExecuting: true,
    outputs: [],
    executionStartTime: startTime,
    executionCount,
  });

  try {
    const result = await window.promptbook.kernel.execute(cell.code);
    const executionTime = Date.now() - startTime;

    if (result.needsEnvironment) {
      handleUpdate(cellId, { isExecuting: false, executionStartTime: undefined });
      setEnvironmentPickerOpen(true);
      return;
    }

    if (result.success && result.outputs) {
      const cellOutputs: CellOutput[] = result.outputs.map((output) => ({
        type: output.type as CellOutput['type'],
        content: output.content,
        mimeType: output.mimeType,
      }));

      const detection = detectMissingPackages(cellOutputs);
      if (detection?.hasMissingPackages) {
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: cellOutputs,
          executionStartTime: undefined,
          lastExecutionTime: executionTime,
          lastExecutionSuccess: false,
        });
        setPackageInstallModal({ isOpen: true, packages: detection.packages, cellId });
        setPackageInstallError(null);
        return;
      }

      handleUpdate(cellId, {
        isExecuting: false,
        outputs: cellOutputs,
        executionStartTime: undefined,
        lastExecutionTime: executionTime,
        lastExecutionSuccess: true,
      });
    } else {
      const errorOutputs: CellOutput[] = [{ type: 'error', content: result.error || 'Execution failed' }];
      const detection = detectMissingPackages(errorOutputs);
      if (detection?.hasMissingPackages) {
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: errorOutputs,
          executionStartTime: undefined,
          lastExecutionTime: executionTime,
          lastExecutionSuccess: false,
        });
        setPackageInstallModal({ isOpen: true, packages: detection.packages, cellId });
        setPackageInstallError(null);
        return;
      }

      handleUpdate(cellId, {
        isExecuting: false,
        outputs: errorOutputs,
        executionStartTime: undefined,
        lastExecutionTime: executionTime,
        lastExecutionSuccess: false,
      });
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    handleUpdate(cellId, {
      isExecuting: false,
      outputs: [{ type: 'error', content: String(error) }],
      executionStartTime: undefined,
      lastExecutionTime: executionTime,
      lastExecutionSuccess: false,
    });
  }
}

// Helper: Sync from code to descriptions
async function syncFromCode(
  cellId: string,
  cell: CellState,
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void
): Promise<void> {
  const codeContent = cell.code?.trim();
  if (!codeContent) {
    handleUpdate(cellId, { isSyncing: false });
    return;
  }

  const shortResult = await window.promptbook.ai.sync(cellId, 'codeToShort', {
    newContent: codeContent,
    previousContent: cell.lastSyncedCode,
    existingCounterpart: cell.shortDescription,
  });

  const fullResult = await window.promptbook.ai.sync(cellId, 'codeToPseudo', {
    newContent: codeContent,
    previousContent: cell.lastSyncedCode,
    existingCounterpart: cell.pseudoCode,
  });

  handleUpdate(cellId, {
    shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
    pseudoCode: fullResult.success ? fullResult.result || '' : cell.pseudoCode,
    lastSyncedCode: codeContent,
    lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
    lastSyncedPseudo: fullResult.success ? fullResult.result : cell.lastSyncedPseudo,
    isDirty: false,
    isSyncing: false, syncStartTime: undefined,
  });
}

// Helper: Sync from short description
async function syncFromShort(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): Promise<void> {
  const shortContent = cell.shortDescription?.trim();
  if (!shortContent) {
    handleUpdate(cellId, { isSyncing: false });
    return;
  }

  const codeResult = await window.promptbook.ai.sync(cellId, 'shortToCode', {
    newContent: shortContent,
    previousContent: cell.lastSyncedShort,
    existingCounterpart: cell.code,
    cellsBefore,
    cellsAfter,
  });

  // Update notebook symbols from LLM response
  if (codeResult.notebookSymbols) {
    updateNotebookSymbols(setNotebook, codeResult.notebookSymbols);
  }

  const fullResult = await window.promptbook.ai.sync(cellId, 'shortToPseudo', {
    newContent: shortContent,
    previousContent: cell.lastSyncedShort,
    existingCounterpart: cell.pseudoCode,
  });

  handleUpdate(cellId, {
    code: codeResult.success ? codeResult.result || '' : cell.code,
    pseudoCode: fullResult.success ? fullResult.result || '' : cell.pseudoCode,
    lastSyncedShort: shortContent,
    lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
    lastSyncedPseudo: fullResult.success ? fullResult.result : cell.lastSyncedPseudo,
    isDirty: false,
    isSyncing: false, syncStartTime: undefined,
  });
}

// Helper: Sync from pseudo-code
async function syncFromPseudo(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): Promise<void> {
  const pseudoContent = cell.pseudoCode?.trim();
  if (!pseudoContent) {
    handleUpdate(cellId, { isSyncing: false });
    return;
  }

  const codeResult = await window.promptbook.ai.sync(cellId, 'pseudoToCode', {
    newContent: pseudoContent,
    previousContent: cell.lastSyncedPseudo,
    existingCounterpart: cell.code,
    cellsBefore,
    cellsAfter,
  });

  // Update notebook symbols from LLM response
  if (codeResult.notebookSymbols) {
    updateNotebookSymbols(setNotebook, codeResult.notebookSymbols);
  }

  const shortResult = await window.promptbook.ai.sync(cellId, 'pseudoToShort', {
    newContent: pseudoContent,
    previousContent: cell.lastSyncedPseudo,
    existingCounterpart: cell.shortDescription,
  });

  handleUpdate(cellId, {
    code: codeResult.success ? codeResult.result || '' : cell.code,
    shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
    lastSyncedPseudo: pseudoContent,
    lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
    lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
    isDirty: false,
    isSyncing: false, syncStartTime: undefined,
  });
}
