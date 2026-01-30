import { ipcMain } from 'electron';
import { projectService, type Project } from '../services/ProjectService';
import { sessionService } from '../services/SessionService';

export function registerProjectHandlers(): void {
  ipcMain.handle('project:getSettings', async () => {
    return { success: true, settings: projectService.getSettings() };
  });

  ipcMain.handle('project:updateSettings', async (_event, updates: { projectsRootPath?: string }) => {
    try {
      const settings = projectService.updateSettings(updates);
      return { success: true, settings };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:list', async () => {
    try {
      const projects = projectService.getAllProjects();
      return { success: true, projects };
    } catch (err) {
      return { success: false, error: String(err), projects: [] };
    }
  });

  ipcMain.handle('project:getRecent', async (_event, limit?: number) => {
    try {
      const projects = projectService.getRecentProjects(limit);
      return { success: true, projects };
    } catch (err) {
      return { success: false, error: String(err), projects: [] };
    }
  });

  ipcMain.handle('project:create', async (_event, name: string, customPath?: string) => {
    try {
      const project = await projectService.createProject(name, customPath);
      return { success: true, project };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:open', async (_event, projectId: string) => {
    try {
      const project = await projectService.openProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      return { success: true, project };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:update', async (_event, projectId: string, updates: Partial<Omit<Project, 'id'>>) => {
    try {
      const project = await projectService.updateProject(projectId, updates);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      return { success: true, project };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:delete', async (_event, projectId: string, deleteFiles: boolean = false) => {
    try {
      const success = await projectService.deleteProject(projectId, deleteFiles);
      sessionService.clearSession(projectId);
      return { success };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:listFiles', async (_event, projectId: string, relativePath?: string) => {
    try {
      const files = await projectService.listFiles(projectId, relativePath);
      return { success: true, files };
    } catch (err) {
      return { success: false, error: String(err), files: [] };
    }
  });

  ipcMain.handle('project:createFile', async (_event, projectId: string, relativePath: string, content?: string) => {
    try {
      await projectService.createFile(projectId, relativePath, content);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:createFolder', async (_event, projectId: string, relativePath: string) => {
    try {
      await projectService.createFolder(projectId, relativePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:deleteFile', async (_event, projectId: string, relativePath: string) => {
    try {
      await projectService.deleteFile(projectId, relativePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:renameFile', async (_event, projectId: string, oldPath: string, newPath: string) => {
    try {
      await projectService.renameFile(projectId, oldPath, newPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:readFile', async (_event, projectId: string, relativePath: string) => {
    try {
      const content = await projectService.readFile(projectId, relativePath);
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:writeFile', async (_event, projectId: string, relativePath: string, content: string) => {
    try {
      await projectService.writeFile(projectId, relativePath, content);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
