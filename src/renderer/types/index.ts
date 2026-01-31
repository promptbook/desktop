import type { Variable } from '@promptbook/ui';

// Types for kernel
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

// Preload API types
export interface KernelAPI {
  getEnvironments: () => Promise<PythonEnvironment[]>;
  scanEnvironments: () => Promise<PythonEnvironment[]>;
  selectEnvironment: (pythonPath: string) => Promise<{
    success: boolean;
    error?: string;
    needsInstall?: boolean;
  }>;
  installIpykernel: (pythonPath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  testPython: (pythonPath: string) => Promise<{
    success: boolean;
    hasIpykernel?: boolean;
  }>;
  createVenv: (venvName?: string) => Promise<{
    success: boolean;
    pythonPath?: string;
    error?: string;
  }>;
  execute: (code: string) => Promise<{
    success: boolean;
    msgId?: string;
    outputs?: KernelOutput[];
    error?: string;
    needsEnvironment?: boolean;
  }>;
  interrupt: () => Promise<{ success: boolean; error?: string }>;
  restart: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<{ state: KernelState; executionCount: number }>;
  getVariables: () => Promise<{
    success: boolean;
    variables: Variable[];
    error?: string;
  }>;
  onOutput: (callback: (output: KernelOutput, msgId: string) => void) => () => void;
  onStateChange: (callback: (state: KernelState) => void) => () => void;
  onError: (callback: (error: string) => void) => () => void;
}

export interface AiAPI {
  sync: (
    cellId: string,
    direction: string,
    context: {
      newContent: string;
      previousContent?: string;
      existingCounterpart?: string;
    }
  ) => Promise<{ success: boolean; result?: string; error?: string }>;
}

export interface FileAPI {
  open: () => Promise<string | undefined>;
  read: (filePath: string) => Promise<unknown>;
  save: (filePath: string, notebook: unknown) => Promise<{ success: boolean }>;
  saveAs: (notebook: unknown) => Promise<{ success: boolean; filePath: string | null }>;
  exportPython: (notebook: unknown) => Promise<{ success: boolean; filePath: string | null }>;
  listDir: (dirPath?: string) => Promise<{
    success: boolean;
    files: { name: string; isDirectory: boolean; path: string }[];
    cwd: string;
    error?: string;
  }>;
}

export interface VersionAPI {
  save: (notebookId: string, content: string, message: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  getHistory: (notebookId: string) => Promise<{ success: boolean; history: Array<{ hash: string; message: string; timestamp: string }>; error?: string }>;
  undo: (notebookId: string) => Promise<{ success: boolean; content?: string; hash?: string; error?: string }>;
  canUndo: (notebookId: string) => Promise<{ success: boolean; canUndo: boolean; error?: string }>;
  getVersion: (notebookId: string, hash: string) => Promise<{ success: boolean; content?: string; error?: string }>;
}

export interface SettingsAPI {
  load: () => Promise<unknown>;
  save: (settings: unknown) => Promise<{ success: boolean }>;
}

export interface ClipboardAPI {
  read: () => Promise<string>;
  write: (text: string) => Promise<{ success: boolean }>;
  readHTML: () => Promise<string>;
  writeHTML: (html: string) => Promise<{ success: boolean }>;
}

// Re-export commonly used types
export type { Variable };
