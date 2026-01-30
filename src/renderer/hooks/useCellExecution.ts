import { useCallback } from 'react';
import type {
  NotebookState,
  CellState,
  CellOutput,
} from '@promptbook/core/ui';
import { detectMissingPackages, MissingPackage } from '@promptbook/core/utils';
import {
  extractParams,
  getParamChanges,
  applyParamChangesToCode,
  applyParamChangesToDescription,
} from '../utils/paramUtils';
import type { CellContext } from '../types';

export interface PackageInstallModalState {
  isOpen: boolean;
  packages: MissingPackage[];
  cellId: string;
}

interface UseCellExecutionParams {
  notebook: NotebookState;
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void;
  handleSaveVersion: (message: string) => Promise<void>;
  onError: (error: string) => void;
  setEnvironmentPickerOpen: (open: boolean) => void;
  setPackageInstallModal: React.Dispatch<React.SetStateAction<PackageInstallModalState>>;
  setPackageInstallError: (error: string | null) => void;
}

export function useCellExecution({
  notebook,
  handleUpdate,
  handleSaveVersion,
  onError,
  setEnvironmentPickerOpen,
  setPackageInstallModal,
  setPackageInstallError,
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

      const hasDescription = cell.shortDescription?.trim() || cell.fullDescription?.trim();
      const hasCode = cell.code?.trim();

      // Handle dirty cell with parameter changes
      if (cell.isDirty && hasDescription && hasCode) {
        const currentShortParams = extractParams(cell.shortDescription || '');
        const currentFullParams = extractParams(cell.fullDescription || '');
        const currentParams = { ...currentShortParams, ...currentFullParams };

        if (cell.lastSyncedParams) {
          const { added, removed, changed } = getParamChanges(cell.lastSyncedParams, currentParams);

          if (added.length === 0 && removed.length === 0 && Object.keys(changed).length > 0) {
            const newCode = applyParamChangesToCode(cell.code, changed);
            const newShort = applyParamChangesToDescription(cell.shortDescription || '', changed);
            const newFull = applyParamChangesToDescription(cell.fullDescription || '', changed);

            handleUpdate(cellId, {
              code: newCode,
              shortDescription: newShort,
              fullDescription: newFull,
              lastSyncedCode: newCode,
              lastSyncedShort: newShort,
              lastSyncedFull: newFull,
              lastSyncedParams: currentParams,
              isDirty: false,
            });
            cell = { ...cell, code: newCode, shortDescription: newShort, fullDescription: newFull };
          }
        }
      }

      // Sync with AI if still dirty
      if (cell.isDirty && hasDescription) {
        cell = await syncCellWithAI(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError);
        if (!cell) return;
      }

      // Generate code if only description exists
      if (hasDescription && !hasCode) {
        cell = await generateCodeFromDescription(cellId, cell, cellsBefore, cellsAfter, handleUpdate, handleSaveVersion, onError);
        if (!cell) return;
      }

      // Execute the code
      await executeCode(cellId, cell, handleUpdate, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError);
    },
    [notebook.cells, handleUpdate, handleSaveVersion, onError, setEnvironmentPickerOpen, setPackageInstallModal, setPackageInstallError]
  );

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cellIndex = notebook.cells.findIndex((c) => c.id === cellId);
      const cell = notebook.cells[cellIndex];
      if (!cell || cell.cellType === 'text') return;

      const cellsBefore: CellContext[] = notebook.cells
        .slice(0, cellIndex)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));
      const cellsAfter: CellContext[] = notebook.cells
        .slice(cellIndex + 1)
        .filter((c) => c.cellType === 'code')
        .map((c) => ({ shortDescription: c.shortDescription || '', code: c.code || '' }));

      const lastEdited = cell.lastEditedTab || 'short';
      handleUpdate(cellId, { isSyncing: true });

      try {
        if (lastEdited === 'code') {
          await syncFromCode(cellId, cell, handleUpdate);
        } else if (lastEdited === 'short') {
          await syncFromShort(cellId, cell, cellsBefore, cellsAfter, handleUpdate);
        } else {
          await syncFromFull(cellId, cell, cellsBefore, cellsAfter, handleUpdate);
        }
      } catch (error) {
        handleUpdate(cellId, { isSyncing: false });
        onError(String(error));
      }
    },
    [notebook.cells, handleUpdate, onError]
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
  onError: (error: string) => void
): Promise<CellState | null> {
  handleUpdate(cellId, { isSyncing: true });
  try {
    const description = cell.fullDescription?.trim() || cell.shortDescription?.trim();
    const syncResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
      newContent: description || '',
      previousContent: cell.lastSyncedFull,
      existingCounterpart: cell.code,
      cellsBefore,
      cellsAfter,
    });

    if (syncResult.success && syncResult.result) {
      const generatedCode = syncResult.result;
      const [shortResult, fullResult] = await Promise.all([
        window.promptbook.ai.sync(cellId, 'codeToShort', {
          newContent: generatedCode,
          existingCounterpart: cell.shortDescription,
        }),
        window.promptbook.ai.sync(cellId, 'codeToFull', {
          newContent: generatedCode,
          existingCounterpart: cell.fullDescription,
        }),
      ]);

      const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
      const newFull = fullResult.success ? fullResult.result || cell.fullDescription : cell.fullDescription;
      const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

      handleUpdate(cellId, {
        code: generatedCode,
        shortDescription: newShort,
        fullDescription: newFull,
        lastSyncedCode: generatedCode,
        lastSyncedShort: newShort,
        lastSyncedFull: newFull,
        lastSyncedParams: syncedParams,
        isDirty: false,
        isSyncing: false,
      });
      handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
      return { ...cell, code: generatedCode, shortDescription: newShort, fullDescription: newFull };
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
  onError: (error: string) => void
): Promise<CellState | null> {
  handleUpdate(cellId, { isSyncing: true });
  try {
    const description = cell.fullDescription?.trim() || cell.shortDescription?.trim();
    const syncResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
      newContent: description || '',
      existingCounterpart: cell.code,
      cellsBefore,
      cellsAfter,
    });

    if (syncResult.success && syncResult.result) {
      const generatedCode = syncResult.result;
      const [shortResult, fullResult] = await Promise.all([
        window.promptbook.ai.sync(cellId, 'codeToShort', {
          newContent: generatedCode,
          existingCounterpart: cell.shortDescription,
        }),
        window.promptbook.ai.sync(cellId, 'codeToFull', {
          newContent: generatedCode,
          existingCounterpart: cell.fullDescription,
        }),
      ]);

      const newShort = shortResult.success ? shortResult.result || cell.shortDescription : cell.shortDescription;
      const newFull = fullResult.success ? fullResult.result || cell.fullDescription : cell.fullDescription;
      const syncedParams = { ...extractParams(newShort), ...extractParams(newFull) };

      handleUpdate(cellId, {
        code: generatedCode,
        shortDescription: newShort,
        fullDescription: newFull,
        lastSyncedCode: generatedCode,
        lastSyncedShort: newShort,
        lastSyncedFull: newFull,
        lastSyncedParams: syncedParams,
        isDirty: false,
        isSyncing: false,
      });
      handleSaveVersion(`AI sync: ${newShort.slice(0, 50)}`);
      return { ...cell, code: generatedCode, shortDescription: newShort, fullDescription: newFull };
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

  const fullResult = await window.promptbook.ai.sync(cellId, 'codeToFull', {
    newContent: codeContent,
    previousContent: cell.lastSyncedCode,
    existingCounterpart: cell.fullDescription,
  });

  handleUpdate(cellId, {
    shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
    fullDescription: fullResult.success ? fullResult.result || '' : cell.fullDescription,
    lastSyncedCode: codeContent,
    lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
    lastSyncedFull: fullResult.success ? fullResult.result : cell.lastSyncedFull,
    isDirty: false,
    isSyncing: false,
  });
}

// Helper: Sync from short description
async function syncFromShort(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void
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

  const fullResult = await window.promptbook.ai.sync(cellId, 'shortToFull', {
    newContent: shortContent,
    previousContent: cell.lastSyncedShort,
    existingCounterpart: cell.fullDescription,
  });

  handleUpdate(cellId, {
    code: codeResult.success ? codeResult.result || '' : cell.code,
    fullDescription: fullResult.success ? fullResult.result || '' : cell.fullDescription,
    lastSyncedShort: shortContent,
    lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
    lastSyncedFull: fullResult.success ? fullResult.result : cell.lastSyncedFull,
    isDirty: false,
    isSyncing: false,
  });
}

// Helper: Sync from full description
async function syncFromFull(
  cellId: string,
  cell: CellState,
  cellsBefore: CellContext[],
  cellsAfter: CellContext[],
  handleUpdate: (cellId: string, updates: Partial<CellState>) => void
): Promise<void> {
  const fullContent = cell.fullDescription?.trim();
  if (!fullContent) {
    handleUpdate(cellId, { isSyncing: false });
    return;
  }

  const codeResult = await window.promptbook.ai.sync(cellId, 'fullToCode', {
    newContent: fullContent,
    previousContent: cell.lastSyncedFull,
    existingCounterpart: cell.code,
    cellsBefore,
    cellsAfter,
  });

  const shortResult = await window.promptbook.ai.sync(cellId, 'fullToShort', {
    newContent: fullContent,
    previousContent: cell.lastSyncedFull,
    existingCounterpart: cell.shortDescription,
  });

  handleUpdate(cellId, {
    code: codeResult.success ? codeResult.result || '' : cell.code,
    shortDescription: shortResult.success ? shortResult.result || '' : cell.shortDescription,
    lastSyncedFull: fullContent,
    lastSyncedCode: codeResult.success ? codeResult.result : cell.lastSyncedCode,
    lastSyncedShort: shortResult.success ? shortResult.result : cell.lastSyncedShort,
    isDirty: false,
    isSyncing: false,
  });
}
