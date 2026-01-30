import { ipcMain } from 'electron';
import { sessionService, type SessionState, type TabState, type SidebarState } from '../services/SessionService';

export function registerSessionHandlers(): void {
  ipcMain.handle('session:load', async (_event, projectId: string) => {
    try {
      const session = sessionService.loadSession(projectId);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:save', async (_event, session: SessionState) => {
    try {
      sessionService.saveSession(session);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:addTab', async (_event, projectId: string, tab: TabState) => {
    try {
      const session = sessionService.addTab(projectId, tab);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:removeTab', async (_event, projectId: string, tabId: string) => {
    try {
      const session = sessionService.removeTab(projectId, tabId);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:setActiveTab', async (_event, projectId: string, tabId: string) => {
    try {
      const session = sessionService.setActiveTab(projectId, tabId);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:updateTab', async (_event, projectId: string, tabId: string, updates: Partial<Omit<TabState, 'id'>>) => {
    try {
      const session = sessionService.updateTab(projectId, tabId, updates);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:reorderTabs', async (_event, projectId: string, fromIndex: number, toIndex: number) => {
    try {
      const session = sessionService.reorderTabs(projectId, fromIndex, toIndex);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:updateSidebar', async (_event, projectId: string, updates: Partial<SidebarState>) => {
    try {
      const session = sessionService.updateSidebar(projectId, updates);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:toggleSidebar', async (_event, projectId: string) => {
    try {
      const session = sessionService.toggleSidebar(projectId);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:pinSidebar', async (_event, projectId: string, pinned: boolean) => {
    try {
      const session = sessionService.pinSidebar(projectId, pinned);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:resizeSidebar', async (_event, projectId: string, width: number) => {
    try {
      const session = sessionService.resizeSidebar(projectId, width);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:cleanupDeletedFiles', async (_event, projectId: string, existingFiles: string[]) => {
    try {
      const session = sessionService.cleanupDeletedFiles(projectId, existingFiles);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
