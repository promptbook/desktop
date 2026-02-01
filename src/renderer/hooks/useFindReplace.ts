import { useState, useCallback } from 'react';
import type { NotebookState, CellState, SearchMatch } from '@promptbook/core';

export interface UseFindReplaceReturn {
  findReplaceOpen: boolean;
  setFindReplaceOpen: (open: boolean) => void;
  handleSearch: (query: string, caseSensitive: boolean, useRegex: boolean) => SearchMatch[];
  handleReplace: (match: SearchMatch, replacement: string) => void;
  handleReplaceAll: (query: string, replacement: string, caseSensitive: boolean, useRegex: boolean) => number;
}

export function useFindReplace(
  notebook: NotebookState,
  setNotebook: React.Dispatch<React.SetStateAction<NotebookState>>
): UseFindReplaceReturn {
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  const handleSearch = useCallback((query: string, caseSensitive: boolean, useRegex: boolean): SearchMatch[] => {
    const matches: SearchMatch[] = [];
    const flags = caseSensitive ? 'g' : 'gi';

    const searchIn = (text: string, field: SearchMatch['field'], cellId: string) => {
      if (!text) return;

      let regex: RegExp;
      try {
        regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch {
        return; // Invalid regex
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          cellId,
          field,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0],
        });
      }
    };

    for (const cell of notebook.cells) {
      if (cell.cellType === 'code') {
        searchIn(cell.shortDescription, 'shortDescription', cell.id);
        searchIn(cell.pseudoCode, 'pseudoCode', cell.id);
        searchIn(cell.code, 'code', cell.id);
      } else {
        searchIn(cell.textContent, 'textContent', cell.id);
      }
    }

    return matches;
  }, [notebook.cells]);

  const handleReplace = useCallback((match: SearchMatch, replacement: string) => {
    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => {
        if (cell.id !== match.cellId) return cell;

        const field = match.field;
        const text = cell[field] as string;
        if (!text) return cell;

        const newText = text.slice(0, match.startIndex) + replacement + text.slice(match.endIndex);
        return { ...cell, [field]: newText };
      }),
    }));
  }, [setNotebook]);

  const handleReplaceAll = useCallback((query: string, replacement: string, caseSensitive: boolean, useRegex: boolean): number => {
    let count = 0;
    const flags = caseSensitive ? 'g' : 'gi';

    setNotebook((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) => {
        let regex: RegExp;
        try {
          regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch {
          return cell;
        }

        const newCell = { ...cell };
        const fields: Array<keyof CellState> = cell.cellType === 'code'
          ? ['shortDescription', 'pseudoCode', 'code']
          : ['textContent'];

        for (const field of fields) {
          const text = cell[field] as string;
          if (!text) continue;

          const newText = text.replace(regex, () => {
            count++;
            return replacement;
          });
          (newCell as Record<string, unknown>)[field] = newText;
        }

        return newCell;
      }),
    }));

    return count;
  }, [setNotebook]);

  return {
    findReplaceOpen,
    setFindReplaceOpen,
    handleSearch,
    handleReplace,
    handleReplaceAll,
  };
}
