import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

interface NotebookCell {
  cellType: 'code' | 'text';
  shortDescription?: string;
  pseudoCode?: string;
  code?: string;
  textContent?: string;
}

interface NotebookExport {
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
  cells: NotebookCell[];
}

export function registerFileHandlers(mainWindow: () => BrowserWindow | null): void {
  // List files in directory for @ autocomplete
  ipcMain.handle('file:listDir', async (_event, dirPath?: string) => {
    try {
      const targetDir = dirPath || process.cwd();
      const entries = await fs.readdir(targetDir, { withFileTypes: true });

      const files: { name: string; isDirectory: boolean; path: string }[] = [];
      for (const entry of entries) {
        // Skip hidden files and common non-data directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
          continue;
        }
        files.push({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          path: path.join(targetDir, entry.name),
        });
      }

      // Sort: directories first, then files, alphabetically
      files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return { success: true, files, cwd: targetDir };
    } catch (err) {
      return { success: false, error: String(err), files: [], cwd: process.cwd() };
    }
  });

  ipcMain.handle('file:open', async () => {
    const { dialog } = await import('electron');
    const window = mainWindow();
    if (!window) return undefined;

    const result = await dialog.showOpenDialog(window, {
      filters: [
        { name: 'Promptbook', extensions: ['yaml', 'yml', 'promptbook'] },
      ],
    });
    return result.filePaths[0];
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return yaml.parse(content);
  });

  ipcMain.handle('file:save', async (_event, filePath: string, notebook: unknown) => {
    const content = yaml.stringify(notebook, {
      indent: 2,
      lineWidth: 120,
    });
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  ipcMain.handle('file:saveAs', async (_event, notebook: unknown) => {
    const { dialog } = await import('electron');
    const window = mainWindow();
    if (!window) return { success: false, filePath: null };

    const result = await dialog.showSaveDialog(window, {
      filters: [
        { name: 'Promptbook YAML', extensions: ['yaml'] },
      ],
      defaultPath: 'notebook.yaml',
    });

    if (result.canceled || !result.filePath) {
      return { success: false, filePath: null };
    }

    const content = yaml.stringify(notebook, {
      indent: 2,
      lineWidth: 120,
    });
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  });

  // Export notebook as Python script
  ipcMain.handle('file:exportPython', async (_event, notebook: NotebookExport) => {
    const { dialog } = await import('electron');
    const window = mainWindow();
    if (!window) return { success: false, filePath: null };

    const result = await dialog.showSaveDialog(window, {
      filters: [
        { name: 'Python Script', extensions: ['py'] },
      ],
      defaultPath: 'notebook.py',
    });

    if (result.canceled || !result.filePath) {
      return { success: false, filePath: null };
    }

    // Generate Python file content
    const lines: string[] = [];

    // Add header comment
    lines.push('#!/usr/bin/env python3');
    lines.push('"""');
    if (notebook.metadata?.title) {
      lines.push(notebook.metadata.title);
    } else {
      lines.push('Exported from Promptbook');
    }
    if (notebook.metadata?.author) {
      lines.push(`Author: ${notebook.metadata.author}`);
    }
    if (notebook.metadata?.created) {
      lines.push(`Created: ${notebook.metadata.created}`);
    }
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push('"""');
    lines.push('');

    // Process each cell
    for (const cell of notebook.cells) {
      if (cell.cellType === 'text') {
        // Convert text cell to docstring/comment
        if (cell.textContent) {
          lines.push('# ' + cell.textContent.split('\n').join('\n# '));
          lines.push('');
        }
      } else if (cell.cellType === 'code') {
        // Add description as comment if available
        const description = cell.shortDescription || cell.pseudoCode;
        if (description) {
          lines.push('# ' + description.split('\n').join('\n# '));
        }
        // Add the code
        if (cell.code) {
          lines.push(cell.code);
          lines.push('');
        }
      }
    }

    const content = lines.join('\n');
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  });
}
