// Type declarations for window.promptbook API exposed by preload.ts

interface KernelOutput {
  type: 'stdout' | 'stderr' | 'result' | 'display' | 'error' | 'status';
  content: string;
  mimeType?: string;
  executionCount?: number;
}

interface PythonEnvironment {
  path: string;
  name: string;
  version: string;
  type: 'venv' | 'conda' | 'system' | 'pyenv' | 'pipenv';
  hasIpykernel: boolean;
}

type KernelState = 'idle' | 'busy' | 'starting' | 'dead' | 'disconnected';

interface Project {
  id: string;
  name: string;
  path: string;
  created: string;
  lastOpened: string;
  color?: string;
  icon?: string;
}

interface ProjectSettings {
  projectsRootPath: string;
  lastOpenedProjectId: string | null;
  recentProjects: string[];
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  absolutePath: string;
}

interface TabState {
  id: string;
  filePath: string;
  scrollPosition: number;
  activeCellId: string | null;
}

interface SidebarState {
  isVisible: boolean;
  isPinned: boolean;
  width: number;
}

interface SessionState {
  projectId: string;
  openTabs: TabState[];
  activeTabId: string | null;
  sidebar: SidebarState;
}

interface PromptbookAPI {
  kernel: {
    getEnvironments: () => Promise<PythonEnvironment[]>;
    scanEnvironments: () => Promise<PythonEnvironment[]>;
    selectEnvironment: (pythonPath: string) => Promise<{ success: boolean; error?: string; needsInstall?: boolean }>;
    installIpykernel: (pythonPath: string) => Promise<{ success: boolean; error?: string }>;
    testPython: (pythonPath: string) => Promise<{ success: boolean; hasIpykernel: boolean }>;
    createVenv: (venvName?: string) => Promise<{ success: boolean; error?: string }>;
    execute: (code: string) => Promise<{ success: boolean; msgId?: string; outputs?: KernelOutput[]; error?: string; needsEnvironment?: boolean }>;
    interrupt: () => Promise<{ success: boolean; error?: string }>;
    restart: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ state: KernelState; executionCount: number }>;
    getVariables: () => Promise<{ success: boolean; variables: unknown[]; error?: string }>;
    onOutput: (callback: (output: KernelOutput, msgId: string) => void) => () => void;
    onStateChange: (callback: (state: KernelState) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };
  ai: {
    sync: (
      cellId: string,
      direction: string,
      context: { newContent: string; previousContent?: string; existingCounterpart?: string }
    ) => Promise<{ success: boolean; result?: string; error?: string }>;
  };
  file: {
    open: () => Promise<string | undefined>;
    read: (filePath: string) => Promise<unknown>;
    save: (filePath: string, notebook: unknown) => Promise<{ success: boolean }>;
    saveAs: (notebook: unknown) => Promise<{ success: boolean; filePath: string | null }>;
    exportPython: (notebook: unknown) => Promise<{ success: boolean; filePath: string | null }>;
    listDir: (dirPath?: string) => Promise<{ success: boolean; files: { name: string; isDirectory: boolean; path: string }[]; cwd: string; error?: string }>;
  };
  settings: {
    load: () => Promise<unknown>;
    save: (settings: unknown) => Promise<{ success: boolean }>;
  };
  clipboard: {
    read: () => Promise<string>;
    write: (text: string) => Promise<{ success: boolean }>;
    readHTML: () => Promise<string>;
    writeHTML: (html: string) => Promise<{ success: boolean }>;
  };
  spellcheck: {
    getLanguages: () => Promise<string[]>;
    setLanguages: (languages: string[]) => Promise<{ success: boolean }>;
    addWord: (word: string) => Promise<{ success: boolean }>;
  };
  version: {
    save: (notebookId: string, content: string, message: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
    getHistory: (notebookId: string) => Promise<{ success: boolean; history: unknown[]; error?: string }>;
    undo: (notebookId: string) => Promise<{ success: boolean; content?: string; hash?: string; error?: string }>;
    canUndo: (notebookId: string) => Promise<{ success: boolean; canUndo: boolean; error?: string }>;
    getVersion: (notebookId: string, hash: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  };
  project: {
    getSettings: () => Promise<{ success: boolean; settings?: ProjectSettings }>;
    updateSettings: (updates: { projectsRootPath?: string }) => Promise<{ success: boolean; settings?: ProjectSettings; error?: string }>;
    list: () => Promise<{ success: boolean; projects: Project[]; error?: string }>;
    getRecent: (limit?: number) => Promise<{ success: boolean; projects: Project[]; error?: string }>;
    create: (name: string, customPath?: string) => Promise<{ success: boolean; project?: Project; error?: string }>;
    open: (projectId: string) => Promise<{ success: boolean; project?: Project; error?: string }>;
    update: (projectId: string, updates: Partial<Omit<Project, 'id'>>) => Promise<{ success: boolean; project?: Project; error?: string }>;
    delete: (projectId: string, deleteFiles?: boolean) => Promise<{ success: boolean; error?: string }>;
    listFiles: (projectId: string, relativePath?: string) => Promise<{ success: boolean; files: FileEntry[]; error?: string }>;
    createFile: (projectId: string, relativePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
    createFolder: (projectId: string, relativePath: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (projectId: string, relativePath: string) => Promise<{ success: boolean; error?: string }>;
    renameFile: (projectId: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    readFile: (projectId: string, relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (projectId: string, relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  };
  session: {
    load: (projectId: string) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    save: (session: SessionState) => Promise<{ success: boolean; error?: string }>;
    addTab: (projectId: string, tab: TabState) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    removeTab: (projectId: string, tabId: string) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    setActiveTab: (projectId: string, tabId: string) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    updateTab: (projectId: string, tabId: string, updates: Partial<Omit<TabState, 'id'>>) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    updateSidebar: (projectId: string, updates: Partial<SidebarState>) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    toggleSidebar: (projectId: string) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    pinSidebar: (projectId: string, pinned: boolean) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    resizeSidebar: (projectId: string, width: number) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
    cleanupDeletedFiles: (projectId: string, existingFiles: string[]) => Promise<{ success: boolean; session?: SessionState; error?: string }>;
  };
}

declare global {
  interface Window {
    promptbook: PromptbookAPI;
  }
}

export {};
