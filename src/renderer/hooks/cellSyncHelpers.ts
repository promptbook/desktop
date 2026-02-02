import type { NotebookState, CellState } from '@promptbook/core';
import type { GeneratedSymbol, CellContext } from '@promptbook/core';
import type { CellOutput } from '@promptbook/core';
import { detectMissingPackages, MissingPackage } from '@promptbook/core';
import { extractParams } from '../utils/paramUtils';

export interface PackageInstallModalState {
  isOpen: boolean;
  packages: MissingPackage[];
  cellId: string;
}

/** Helper to update notebook symbols from LLM response */
export function updateNotebookSymbols(
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

/** Sync cell with AI when dirty */
export async function syncCellWithAI(
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

/** Generate code from description */
export async function generateCodeFromDescription(
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

/** Execute code in kernel */
export async function executeCode(
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

/** Sync from code to descriptions */
export async function syncFromCode(
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

/** Sync from short description */
export async function syncFromShort(
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

/** Sync from pseudo-code */
export async function syncFromPseudo(
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
