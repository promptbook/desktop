import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';

// Types (matching main process types)
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
  recentProjects: string[];
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  absolutePath: string;
}

// State
interface ProjectState {
  projects: Project[];
  recentProjects: Project[];
  currentProject: Project | null;
  settings: ProjectSettings | null;
  isLoading: boolean;
  error: string | null;
}

// Actions
type ProjectAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_RECENT_PROJECTS'; payload: Project[] }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'SET_SETTINGS'; payload: ProjectSettings }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string };

// Reducer
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_RECENT_PROJECTS':
      return { ...state, recentProjects: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p),
        currentProject: state.currentProject?.id === action.payload.id ? action.payload : state.currentProject,
      };
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        currentProject: state.currentProject?.id === action.payload ? null : state.currentProject,
      };
    default:
      return state;
  }
}

// Initial state
const initialState: ProjectState = {
  projects: [],
  recentProjects: [],
  currentProject: null,
  settings: null,
  isLoading: true,
  error: null,
};

// Context type
interface ProjectContextType {
  state: ProjectState;
  // Project operations
  loadProjects: () => Promise<void>;
  createProject: (name: string, customPath?: string) => Promise<Project | null>;
  openProject: (projectId: string) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'id'>>) => Promise<Project | null>;
  deleteProject: (projectId: string, deleteFiles?: boolean) => Promise<boolean>;
  closeProject: () => void;
  // Settings
  updateSettings: (updates: { projectsRootPath?: string }) => Promise<void>;
  // File operations (within current project)
  listFiles: (relativePath?: string) => Promise<FileEntry[]>;
  createFile: (relativePath: string, content?: string) => Promise<boolean>;
  createFolder: (relativePath: string) => Promise<boolean>;
  deleteFile: (relativePath: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  readFile: (relativePath: string) => Promise<string | null>;
  writeFile: (relativePath: string, content: string) => Promise<boolean>;
}

// Create context
const ProjectContext = createContext<ProjectContextType | null>(null);

// Helper type for dispatch
type ProjectDispatch = React.Dispatch<ProjectAction>;

// ============================================================
// Settings & Loading Helpers
// ============================================================

async function loadSettingsHelper(dispatch: ProjectDispatch): Promise<void> {
  try {
    const result = await window.promptbook.project.getSettings();
    if (result.success && result.settings) {
      dispatch({ type: 'SET_SETTINGS', payload: result.settings });
    }
  } catch (err) {
    console.error('Failed to load project settings:', err);
  }
}

async function loadProjectsHelper(dispatch: ProjectDispatch): Promise<void> {
  dispatch({ type: 'SET_LOADING', payload: true });
  try {
    const [listResult, recentResult] = await Promise.all([
      window.promptbook.project.list(),
      window.promptbook.project.getRecent(10),
    ]);
    if (listResult.success) {
      dispatch({ type: 'SET_PROJECTS', payload: listResult.projects });
    }
    if (recentResult.success) {
      dispatch({ type: 'SET_RECENT_PROJECTS', payload: recentResult.projects });
    }
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
  } finally {
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

async function updateSettingsHelper(
  dispatch: ProjectDispatch,
  updates: { projectsRootPath?: string }
): Promise<void> {
  try {
    const result = await window.promptbook.project.updateSettings(updates);
    if (result.success && result.settings) {
      dispatch({ type: 'SET_SETTINGS', payload: result.settings });
    }
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
  }
}

// ============================================================
// Project CRUD Helpers
// ============================================================

async function handleCreateProject(
  dispatch: ProjectDispatch,
  name: string,
  customPath?: string
): Promise<Project | null> {
  try {
    const result = await window.promptbook.project.create(name, customPath);
    if (result.success && result.project) {
      dispatch({ type: 'ADD_PROJECT', payload: result.project });
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: result.project });
      return result.project;
    }
    dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to create project' });
    return null;
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
    return null;
  }
}

async function handleOpenProject(
  dispatch: ProjectDispatch,
  projectId: string
): Promise<Project | null> {
  try {
    const result = await window.promptbook.project.open(projectId);
    if (result.success && result.project) {
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: result.project });
      dispatch({ type: 'UPDATE_PROJECT', payload: result.project });
      const recentResult = await window.promptbook.project.getRecent(10);
      if (recentResult.success) {
        dispatch({ type: 'SET_RECENT_PROJECTS', payload: recentResult.projects });
      }
      return result.project;
    }
    dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to open project' });
    return null;
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
    return null;
  }
}

async function handleUpdateProject(
  dispatch: ProjectDispatch,
  projectId: string,
  updates: Partial<Omit<Project, 'id'>>
): Promise<Project | null> {
  try {
    const result = await window.promptbook.project.update(projectId, updates);
    if (result.success && result.project) {
      dispatch({ type: 'UPDATE_PROJECT', payload: result.project });
      return result.project;
    }
    dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to update project' });
    return null;
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
    return null;
  }
}

async function handleDeleteProject(
  dispatch: ProjectDispatch,
  projectId: string,
  deleteFiles: boolean = false
): Promise<boolean> {
  try {
    const result = await window.promptbook.project.delete(projectId, deleteFiles);
    if (result.success) {
      dispatch({ type: 'REMOVE_PROJECT', payload: projectId });
      const recentResult = await window.promptbook.project.getRecent(10);
      if (recentResult.success) {
        dispatch({ type: 'SET_RECENT_PROJECTS', payload: recentResult.projects });
      }
      return true;
    }
    dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to delete project' });
    return false;
  } catch (err) {
    dispatch({ type: 'SET_ERROR', payload: String(err) });
    return false;
  }
}

// ============================================================
// File Operation Helpers (extracted for maintainability)
// ============================================================

async function handleListFiles(
  projectId: string | undefined,
  relativePath?: string
): Promise<FileEntry[]> {
  if (!projectId) return [];
  try {
    const result = await window.promptbook.project.listFiles(projectId, relativePath);
    return result.success ? result.files : [];
  } catch (err) {
    console.error('Failed to list files:', err);
    return [];
  }
}

async function handleCreateFile(
  projectId: string | undefined,
  relativePath: string,
  content?: string
): Promise<boolean> {
  if (!projectId) return false;
  try {
    const result = await window.promptbook.project.createFile(projectId, relativePath, content);
    return result.success;
  } catch (err) {
    console.error('Failed to create file:', err);
    return false;
  }
}

async function handleCreateFolder(
  projectId: string | undefined,
  relativePath: string
): Promise<boolean> {
  if (!projectId) return false;
  try {
    const result = await window.promptbook.project.createFolder(projectId, relativePath);
    return result.success;
  } catch (err) {
    console.error('Failed to create folder:', err);
    return false;
  }
}

async function handleDeleteFile(
  projectId: string | undefined,
  relativePath: string
): Promise<boolean> {
  if (!projectId) return false;
  try {
    const result = await window.promptbook.project.deleteFile(projectId, relativePath);
    return result.success;
  } catch (err) {
    console.error('Failed to delete file:', err);
    return false;
  }
}

async function handleRenameFile(
  projectId: string | undefined,
  oldPath: string,
  newPath: string
): Promise<boolean> {
  if (!projectId) return false;
  try {
    const result = await window.promptbook.project.renameFile(projectId, oldPath, newPath);
    return result.success;
  } catch (err) {
    console.error('Failed to rename file:', err);
    return false;
  }
}

async function handleReadFile(
  projectId: string | undefined,
  relativePath: string
): Promise<string | null> {
  if (!projectId) return null;
  try {
    const result = await window.promptbook.project.readFile(projectId, relativePath);
    return result.success ? result.content : null;
  } catch (err) {
    console.error('Failed to read file:', err);
    return null;
  }
}

async function handleWriteFile(
  projectId: string | undefined,
  relativePath: string,
  content: string
): Promise<boolean> {
  if (!projectId) return false;
  try {
    const result = await window.promptbook.project.writeFile(projectId, relativePath, content);
    return result.success;
  } catch (err) {
    console.error('Failed to write file:', err);
    return false;
  }
}

// ============================================================
// Provider Component
// ============================================================

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const currentProjectId = state.currentProject?.id;

  // Load projects and settings on mount
  const loadSettings = useCallback(() => loadSettingsHelper(dispatch), []);
  const loadProjects = useCallback(() => loadProjectsHelper(dispatch), []);
  useEffect(() => { loadProjects(); loadSettings(); }, [loadProjects, loadSettings]);

  // Project CRUD operations
  const createProject = useCallback(
    (name: string, customPath?: string) => handleCreateProject(dispatch, name, customPath), []);
  const openProject = useCallback(
    (projectId: string) => handleOpenProject(dispatch, projectId), []);
  const updateProject = useCallback(
    (projectId: string, updates: Partial<Omit<Project, 'id'>>) =>
      handleUpdateProject(dispatch, projectId, updates), []);
  const deleteProject = useCallback(
    (projectId: string, deleteFiles?: boolean) => handleDeleteProject(dispatch, projectId, deleteFiles), []);
  const closeProject = useCallback(() => dispatch({ type: 'SET_CURRENT_PROJECT', payload: null }), []);
  const updateSettings = useCallback(
    (updates: { projectsRootPath?: string }) => updateSettingsHelper(dispatch, updates), []);

  // File operations
  const listFiles = useCallback(
    (relativePath?: string) => handleListFiles(currentProjectId, relativePath), [currentProjectId]);
  const createFile = useCallback(
    (relativePath: string, content?: string) => handleCreateFile(currentProjectId, relativePath, content),
    [currentProjectId]);
  const createFolder = useCallback(
    (relativePath: string) => handleCreateFolder(currentProjectId, relativePath), [currentProjectId]);
  const deleteFile = useCallback(
    (relativePath: string) => handleDeleteFile(currentProjectId, relativePath), [currentProjectId]);
  const renameFile = useCallback(
    (oldPath: string, newPath: string) => handleRenameFile(currentProjectId, oldPath, newPath),
    [currentProjectId]);
  const readFile = useCallback(
    (relativePath: string) => handleReadFile(currentProjectId, relativePath), [currentProjectId]);
  const writeFile = useCallback(
    (relativePath: string, content: string) => handleWriteFile(currentProjectId, relativePath, content),
    [currentProjectId]);

  const value: ProjectContextType = {
    state, loadProjects, createProject, openProject, updateProject, deleteProject,
    closeProject, updateSettings, listFiles, createFile, createFolder, deleteFile,
    renameFile, readFile, writeFile,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// Hook
export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
