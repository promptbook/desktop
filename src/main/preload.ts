import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Import shared types from @promptbook/core
import type {
  KernelOutput,
  KernelState,
  PythonEnvironment,
  Project,
  ProjectSettings,
  ProjectFileEntry,
  TabState,
  SidebarState,
  SessionState,
} from '@promptbook/core';

// Re-export types for consumers of this preload
export type {
  KernelOutput,
  KernelState,
  PythonEnvironment,
  Project,
  ProjectSettings,
  ProjectFileEntry,
  TabState,
  SidebarState,
  SessionState,
};

// Alias for backward compatibility
export type FileEntry = ProjectFileEntry;

contextBridge.exposeInMainWorld('promptbook', {
  kernel: {
    // Environment management
    getEnvironments: () => ipcRenderer.invoke('kernel:getEnvironments'),
    scanEnvironments: () => ipcRenderer.invoke('kernel:scanEnvironments'),
    selectEnvironment: (pythonPath: string) =>
      ipcRenderer.invoke('kernel:selectEnvironment', pythonPath),
    installIpykernel: (pythonPath: string) =>
      ipcRenderer.invoke('kernel:installIpykernel', pythonPath),
    testPython: (pythonPath: string) =>
      ipcRenderer.invoke('kernel:testPython', pythonPath),
    createVenv: (venvName?: string) =>
      ipcRenderer.invoke('kernel:createVenv', venvName),

    // Execution
    execute: (code: string) => ipcRenderer.invoke('kernel:execute', code),
    interrupt: () => ipcRenderer.invoke('kernel:interrupt'),
    restart: () => ipcRenderer.invoke('kernel:restart'),
    getStatus: () => ipcRenderer.invoke('kernel:getStatus'),
    getVariables: () => ipcRenderer.invoke('kernel:getVariables'),
    getSymbols: () => ipcRenderer.invoke('kernel:getSymbols'),

    // Package management
    listPackages: () => ipcRenderer.invoke('kernel:listPackages'),
    installPackage: (packageName: string) =>
      ipcRenderer.invoke('kernel:installPackage', packageName),
    uninstallPackage: (packageName: string) =>
      ipcRenderer.invoke('kernel:uninstallPackage', packageName),

    // Working directory
    setWorkingDir: (dir: string | null) =>
      ipcRenderer.invoke('kernel:setWorkingDir', dir),
    getWorkingDir: () => ipcRenderer.invoke('kernel:getWorkingDir'),

    // Event listeners
    onOutput: (callback: (output: KernelOutput, msgId: string) => void) => {
      const handler = (_event: IpcRendererEvent, output: KernelOutput, msgId: string) =>
        callback(output, msgId);
      ipcRenderer.on('kernel:output', handler);
      return () => ipcRenderer.removeListener('kernel:output', handler);
    },
    onStateChange: (callback: (state: KernelState) => void) => {
      const handler = (_event: IpcRendererEvent, state: KernelState) => callback(state);
      ipcRenderer.on('kernel:stateChange', handler);
      return () => ipcRenderer.removeListener('kernel:stateChange', handler);
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_event: IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on('kernel:error', handler);
      return () => ipcRenderer.removeListener('kernel:error', handler);
    },
  },
  ai: {
    sync: (
      cellId: string,
      direction: string,
      context: {
        newContent: string;
        previousContent?: string;
        existingCounterpart?: string;
      }
    ) => ipcRenderer.invoke('ai:sync', cellId, direction, context),
  },
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    save: (filePath: string, notebook: unknown) =>
      ipcRenderer.invoke('file:save', filePath, notebook),
    saveAs: (notebook: unknown) => ipcRenderer.invoke('file:saveAs', notebook),
    exportPython: (notebook: unknown) => ipcRenderer.invoke('file:exportPython', notebook),
    listDir: (dirPath?: string) => ipcRenderer.invoke('file:listDir', dirPath),
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text),
    readHTML: () => ipcRenderer.invoke('clipboard:readHTML'),
    writeHTML: (html: string) => ipcRenderer.invoke('clipboard:writeHTML', html),
  },
  spellcheck: {
    getLanguages: () => ipcRenderer.invoke('spellcheck:getLanguages'),
    setLanguages: (languages: string[]) => ipcRenderer.invoke('spellcheck:setLanguages', languages),
    addWord: (word: string) => ipcRenderer.invoke('spellcheck:addWord', word),
  },
  version: {
    save: (notebookId: string, content: string, message: string) =>
      ipcRenderer.invoke('version:save', notebookId, content, message),
    getHistory: (notebookId: string) =>
      ipcRenderer.invoke('version:getHistory', notebookId),
    undo: (notebookId: string) =>
      ipcRenderer.invoke('version:undo', notebookId),
    canUndo: (notebookId: string) =>
      ipcRenderer.invoke('version:canUndo', notebookId),
    getVersion: (notebookId: string, hash: string) =>
      ipcRenderer.invoke('version:getVersion', notebookId, hash),
  },
  project: {
    getSettings: () => ipcRenderer.invoke('project:getSettings'),
    updateSettings: (updates: { projectsRootPath?: string }) =>
      ipcRenderer.invoke('project:updateSettings', updates),
    list: () => ipcRenderer.invoke('project:list'),
    getRecent: (limit?: number) => ipcRenderer.invoke('project:getRecent', limit),
    getPath: (projectId: string) => ipcRenderer.invoke('project:getPath', projectId),
    create: (name: string, customPath?: string) =>
      ipcRenderer.invoke('project:create', name, customPath),
    open: (projectId: string) => ipcRenderer.invoke('project:open', projectId),
    update: (projectId: string, updates: Partial<Omit<Project, 'id'>>) =>
      ipcRenderer.invoke('project:update', projectId, updates),
    delete: (projectId: string, deleteFiles?: boolean) =>
      ipcRenderer.invoke('project:delete', projectId, deleteFiles),
    listFiles: (projectId: string, relativePath?: string) =>
      ipcRenderer.invoke('project:listFiles', projectId, relativePath),
    createFile: (projectId: string, relativePath: string, content?: string) =>
      ipcRenderer.invoke('project:createFile', projectId, relativePath, content),
    createFolder: (projectId: string, relativePath: string) =>
      ipcRenderer.invoke('project:createFolder', projectId, relativePath),
    deleteFile: (projectId: string, relativePath: string) =>
      ipcRenderer.invoke('project:deleteFile', projectId, relativePath),
    renameFile: (projectId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('project:renameFile', projectId, oldPath, newPath),
    readFile: (projectId: string, relativePath: string) =>
      ipcRenderer.invoke('project:readFile', projectId, relativePath),
    writeFile: (projectId: string, relativePath: string, content: string) =>
      ipcRenderer.invoke('project:writeFile', projectId, relativePath, content),
    saveNotebook: (projectId: string, relativePath: string, notebook: unknown) =>
      ipcRenderer.invoke('project:saveNotebook', projectId, relativePath, notebook),
  },
  session: {
    load: (projectId: string) => ipcRenderer.invoke('session:load', projectId),
    save: (session: SessionState) => ipcRenderer.invoke('session:save', session),
    addTab: (projectId: string, tab: TabState) =>
      ipcRenderer.invoke('session:addTab', projectId, tab),
    removeTab: (projectId: string, tabId: string) =>
      ipcRenderer.invoke('session:removeTab', projectId, tabId),
    setActiveTab: (projectId: string, tabId: string) =>
      ipcRenderer.invoke('session:setActiveTab', projectId, tabId),
    updateTab: (projectId: string, tabId: string, updates: Partial<Omit<TabState, 'id'>>) =>
      ipcRenderer.invoke('session:updateTab', projectId, tabId, updates),
    reorderTabs: (projectId: string, fromIndex: number, toIndex: number) =>
      ipcRenderer.invoke('session:reorderTabs', projectId, fromIndex, toIndex),
    updateSidebar: (projectId: string, updates: Partial<SidebarState>) =>
      ipcRenderer.invoke('session:updateSidebar', projectId, updates),
    toggleSidebar: (projectId: string) =>
      ipcRenderer.invoke('session:toggleSidebar', projectId),
    pinSidebar: (projectId: string, pinned: boolean) =>
      ipcRenderer.invoke('session:pinSidebar', projectId, pinned),
    resizeSidebar: (projectId: string, width: number) =>
      ipcRenderer.invoke('session:resizeSidebar', projectId, width),
    cleanupDeletedFiles: (projectId: string, existingFiles: string[]) =>
      ipcRenderer.invoke('session:cleanupDeletedFiles', projectId, existingFiles),
  },
  // Test utilities (only active in test mode)
  test: {
    onEvent: (callback: (eventName: string, data: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, eventName: string, data: unknown) =>
        callback(eventName, data);
      ipcRenderer.on('test:event', handler);
      return () => ipcRenderer.removeListener('test:event', handler);
    },
    isTestMode: () => process.env.PROMPTBOOK_TEST_MODE === 'true',
  },
  // DataFrame operations
  dataframe: {
    getPage: (dfId: string, page: number, pageSize: number) =>
      ipcRenderer.invoke('dataframe:getPage', dfId, page, pageSize),
    editCell: (dfId: string, rowIndex: number, column: string, value: unknown) =>
      ipcRenderer.invoke('dataframe:editCell', dfId, rowIndex, column, value),
    addRow: (dfId: string, rowData?: Record<string, unknown>) =>
      ipcRenderer.invoke('dataframe:addRow', dfId, rowData),
    deleteRow: (dfId: string, rowIndex: number) =>
      ipcRenderer.invoke('dataframe:deleteRow', dfId, rowIndex),
    addColumn: (dfId: string, column: string, dtype?: string, defaultValue?: unknown) =>
      ipcRenderer.invoke('dataframe:addColumn', dfId, column, dtype, defaultValue),
    deleteColumn: (dfId: string, column: string) =>
      ipcRenderer.invoke('dataframe:deleteColumn', dfId, column),
    renameColumn: (dfId: string, column: string, newName: string) =>
      ipcRenderer.invoke('dataframe:renameColumn', dfId, column, newName),
    changeColumnType: (dfId: string, column: string, newType: string) =>
      ipcRenderer.invoke('dataframe:changeColumnType', dfId, column, newType),
  },
});
