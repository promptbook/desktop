import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Types for kernel outputs
export interface KernelOutput {
  type: 'stdout' | 'stderr' | 'result' | 'display' | 'error' | 'status';
  content: string;
  mimeType?: string;
  executionCount?: number;
}

export interface PythonEnvironment {
  path: string;
  name: string;
  version: string;
  type: 'venv' | 'conda' | 'system' | 'pyenv' | 'pipenv';
  hasIpykernel: boolean;
}

export type KernelState = 'idle' | 'busy' | 'starting' | 'dead' | 'disconnected';

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
});
