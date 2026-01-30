import { ipcMain } from 'electron';
import { versionManager } from '../kernel/VersionManager';

export function registerVersionHandlers(): void {
  ipcMain.handle('version:save', async (_event, notebookId: string, content: string, message: string) => {
    try {
      const hash = await versionManager.saveVersion(notebookId, content, message);
      return { success: true, hash };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('version:getHistory', async (_event, notebookId: string) => {
    try {
      const history = await versionManager.getHistory(notebookId);
      return { success: true, history };
    } catch (err) {
      return { success: false, error: String(err), history: [] };
    }
  });

  ipcMain.handle('version:undo', async (_event, notebookId: string) => {
    try {
      const result = await versionManager.undo(notebookId);
      if (result) {
        return { success: true, content: result.content, hash: result.hash };
      }
      return { success: false, error: 'No previous version available' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('version:canUndo', async (_event, notebookId: string) => {
    try {
      const canUndo = await versionManager.canUndo(notebookId);
      return { success: true, canUndo };
    } catch (err) {
      return { success: false, error: String(err), canUndo: false };
    }
  });

  ipcMain.handle('version:getVersion', async (_event, notebookId: string, hash: string) => {
    try {
      const content = await versionManager.getVersion(notebookId, hash);
      if (content) {
        return { success: true, content };
      }
      return { success: false, error: 'Version not found' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
