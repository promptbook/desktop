import React, { useState, useCallback } from 'react';
import {
  Notebook,
  NotebookState,
  CellState,
  createEmptyNotebook,
  createEmptyCell,
} from '@promptbook/core';

// Type for the preload API
declare global {
  interface Window {
    promptbook: {
      kernel: {
        execute: (code: string) => Promise<{ success: boolean; output: string }>;
      };
      ai: {
        sync: (cellId: string, direction: string) => Promise<{ success: boolean }>;
      };
      file: {
        open: () => Promise<string | undefined>;
        save: (path: string, content: string) => Promise<{ success: boolean }>;
      };
    };
  }
}

export function App() {
  const [notebook, setNotebook] = useState<NotebookState>(createEmptyNotebook());
  const [filePath, setFilePath] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (cellId: string, updates: Partial<CellState>) => {
      setNotebook((prev) => ({
        ...prev,
        cells: prev.cells.map((cell) =>
          cell.id === cellId ? { ...cell, ...updates } : cell
        ),
        metadata: { ...prev.metadata, modified: new Date().toISOString() },
      }));
    },
    []
  );

  const handleRunCell = useCallback(
    async (cellId: string) => {
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell) return;

      handleUpdate(cellId, { isExecuting: true, outputs: [] });

      try {
        const result = await window.promptbook.kernel.execute(cell.code);
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: [{ type: 'result', content: result.output }],
        });
      } catch (error) {
        handleUpdate(cellId, {
          isExecuting: false,
          outputs: [{ type: 'error', content: String(error) }],
        });
      }
    },
    [notebook.cells, handleUpdate]
  );

  const handleSyncCell = useCallback(
    async (cellId: string) => {
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell) return;

      const direction =
        cell.lastEditedTab === 'instructions' ? 'toCode' : 'toInstructions';
      await window.promptbook.ai.sync(cellId, direction);
      handleUpdate(cellId, { isDirty: false });
    },
    [notebook.cells, handleUpdate]
  );

  const handleAddCell = useCallback((afterCellId?: string) => {
    const newCell = createEmptyCell(`cell-${Date.now()}`);
    setNotebook((prev) => {
      if (!afterCellId) {
        return { ...prev, cells: [...prev.cells, newCell] };
      }
      const index = prev.cells.findIndex((c) => c.id === afterCellId);
      const newCells = [...prev.cells];
      newCells.splice(index + 1, 0, newCell);
      return { ...prev, cells: newCells };
    });
  }, []);

  const handleDeleteCell = useCallback((cellId: string) => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.filter((c) => c.id !== cellId),
    }));
  }, []);

  const handleOpen = async () => {
    const path = await window.promptbook.file.open();
    if (path) {
      // TODO: Read file content
      setFilePath(path);
    }
  };

  const handleSave = async () => {
    if (!filePath) return;
    await window.promptbook.file.save(filePath, JSON.stringify(notebook, null, 2));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Promptbook</h1>
        <div className="app-actions">
          <button onClick={handleOpen}>Open</button>
          <button onClick={handleSave} disabled={!filePath}>
            Save
          </button>
        </div>
      </header>
      <main className="app-main">
        <Notebook
          notebook={notebook}
          onUpdate={handleUpdate}
          onRunCell={handleRunCell}
          onSyncCell={handleSyncCell}
          onAddCell={handleAddCell}
          onDeleteCell={handleDeleteCell}
        />
      </main>
    </div>
  );
}
