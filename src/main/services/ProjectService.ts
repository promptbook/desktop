import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';
import Store from 'electron-store';

export interface Project {
  id: string;
  name: string;
  path: string;
  created: string;
  lastOpened: string;
  color?: string;
  icon?: string;
}

export interface ProjectSettings {
  projectsRootPath: string;
  lastOpenedProjectId: string | null;
  recentProjects: string[]; // Array of project IDs
}

const DEFAULT_PROJECTS_ROOT = path.join(os.homedir(), 'promptbook_projects');

/**
 * Validate and resolve a relative path to prevent path traversal attacks.
 * Throws if the resolved path escapes the root directory.
 */
function validateRelativePath(rootDir: string, relativePath: string): string {
  // Normalize and resolve the full path
  const resolved = path.resolve(rootDir, relativePath);
  // Ensure the resolved path starts with the root directory
  const normalizedRoot = path.resolve(rootDir) + path.sep;
  const normalizedResolved = path.resolve(resolved);

  if (!normalizedResolved.startsWith(normalizedRoot) && normalizedResolved !== path.resolve(rootDir)) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }

  return resolved;
}

const defaultProjectSettings: ProjectSettings = {
  projectsRootPath: DEFAULT_PROJECTS_ROOT,
  lastOpenedProjectId: null,
  recentProjects: [],
};

class ProjectService {
  private store: Store<{ projectSettings: ProjectSettings; projects: Record<string, Project> }>;

  constructor() {
    this.store = new Store({
      name: 'promptbook-projects',
      defaults: {
        projectSettings: defaultProjectSettings,
        projects: {},
      },
    });
  }

  // Settings
  getSettings(): ProjectSettings {
    return this.store.get('projectSettings', defaultProjectSettings);
  }

  updateSettings(updates: Partial<ProjectSettings>): ProjectSettings {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    this.store.set('projectSettings', updated);
    return updated;
  }

  getProjectsRootPath(): string {
    return this.getSettings().projectsRootPath;
  }

  setProjectsRootPath(rootPath: string): void {
    this.updateSettings({ projectsRootPath: rootPath });
  }

  // Project CRUD
  async createProject(name: string, customPath?: string): Promise<Project> {
    const id = crypto.randomUUID();
    const rootPath = this.getProjectsRootPath();
    const projectPath = customPath || path.join(rootPath, name);

    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });

    const now = new Date().toISOString();
    const project: Project = {
      id,
      name,
      path: projectPath,
      created: now,
      lastOpened: now,
    };

    // Save to store
    const projects = this.store.get('projects', {});
    projects[id] = project;
    this.store.set('projects', projects);

    // Update recent projects
    this.addToRecentProjects(id);

    return project;
  }

  getProject(id: string): Project | null {
    const projects = this.store.get('projects', {});
    return projects[id] || null;
  }

  getAllProjects(): Project[] {
    const projects = this.store.get('projects', {});
    return Object.values(projects);
  }

  getRecentProjects(limit: number = 10): Project[] {
    const settings = this.getSettings();
    const projects = this.store.get('projects', {});

    return settings.recentProjects
      .slice(0, limit)
      .map(id => projects[id])
      .filter((p): p is Project => p !== undefined);
  }

  async updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Promise<Project | null> {
    const projects = this.store.get('projects', {});
    const project = projects[id];

    if (!project) return null;

    // Handle rename (also rename directory)
    if (updates.name && updates.name !== project.name) {
      const parentDir = path.dirname(project.path);
      const newPath = path.join(parentDir, updates.name);

      try {
        await fs.rename(project.path, newPath);
        updates.path = newPath;
      } catch (err) {
        throw new Error(`Failed to rename project directory: ${err}`);
      }
    }

    const updated = { ...project, ...updates };
    projects[id] = updated;
    this.store.set('projects', projects);

    return updated;
  }

  async deleteProject(id: string, deleteFiles: boolean = false): Promise<boolean> {
    const projects = this.store.get('projects', {});
    const project = projects[id];

    if (!project) return false;

    // Optionally delete files
    if (deleteFiles) {
      try {
        await fs.rm(project.path, { recursive: true, force: true });
      } catch (err) {
        console.error(`Failed to delete project files: ${err}`);
      }
    }

    // Remove from store
    delete projects[id];
    this.store.set('projects', projects);

    // Remove from recent projects
    this.removeFromRecentProjects(id);

    // Clear last opened if it was this project
    const settings = this.getSettings();
    if (settings.lastOpenedProjectId === id) {
      this.updateSettings({ lastOpenedProjectId: null });
    }

    return true;
  }

  // Open project
  async openProject(id: string): Promise<Project | null> {
    const project = this.getProject(id);
    if (!project) return null;

    // Verify directory exists
    try {
      await fs.access(project.path);
    } catch {
      throw new Error(`Project directory not found: ${project.path}`);
    }

    // Update last opened
    const updated = await this.updateProject(id, { lastOpened: new Date().toISOString() });

    // Update settings
    this.updateSettings({ lastOpenedProjectId: id });
    this.addToRecentProjects(id);

    return updated;
  }

  // Recent projects management
  private addToRecentProjects(id: string): void {
    const settings = this.getSettings();
    const recent = settings.recentProjects.filter(pid => pid !== id);
    recent.unshift(id);
    this.updateSettings({ recentProjects: recent.slice(0, 20) });
  }

  private removeFromRecentProjects(id: string): void {
    const settings = this.getSettings();
    const recent = settings.recentProjects.filter(pid => pid !== id);
    this.updateSettings({ recentProjects: recent });
  }

  // File operations within project
  async listFiles(projectId: string, relativePath: string = ''): Promise<FileEntry[]> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const targetPath = validateRelativePath(project.path, relativePath);
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const files: FileEntry[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files

      files.push({
        name: entry.name,
        path: path.join(relativePath, entry.name),
        isDirectory: entry.isDirectory(),
        absolutePath: path.join(targetPath, entry.name),
      });
    }

    // Sort: directories first, then alphabetically
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return files;
  }

  async createFile(projectId: string, relativePath: string, content: string = ''): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const filePath = validateRelativePath(project.path, relativePath);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async createFolder(projectId: string, relativePath: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const folderPath = validateRelativePath(project.path, relativePath);
    await fs.mkdir(folderPath, { recursive: true });
  }

  async deleteFile(projectId: string, relativePath: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const filePath = validateRelativePath(project.path, relativePath);
    await fs.rm(filePath, { recursive: true, force: true });
  }

  async renameFile(projectId: string, oldPath: string, newPath: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const oldFilePath = validateRelativePath(project.path, oldPath);
    const newFilePath = validateRelativePath(project.path, newPath);

    await fs.rename(oldFilePath, newFilePath);
  }

  async readFile(projectId: string, relativePath: string): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const filePath = validateRelativePath(project.path, relativePath);
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(projectId: string, relativePath: string, content: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const filePath = validateRelativePath(project.path, relativePath);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // Check if project directory exists
  async projectExists(id: string): Promise<boolean> {
    const project = this.getProject(id);
    if (!project) return false;

    try {
      await fs.access(project.path);
      return true;
    } catch {
      return false;
    }
  }
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  absolutePath: string;
}

// Export singleton instance
export const projectService = new ProjectService();
