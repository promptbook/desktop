import type { NotebookState, Variable, KernelSymbol } from '@promptbook/core';
import type { GeneratedSymbol } from '@promptbook/core';
import type { AppSettings } from './Settings';

// Paper type for Semantic Scholar results
export interface Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  authors: { name: string }[];
  citationCount: number;
  url: string;
}

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

// Cell context for AI sync
export interface CellContext {
  shortDescription: string;
  code: string;
}

// Type for the preload API
declare global {
  interface Window {
    promptbook: {
      kernel: {
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
        getSymbols: () => Promise<{
          success: boolean;
          symbols: KernelSymbol[];
          error?: string;
        }>;
        listPackages: () => Promise<{
          success: boolean;
          packages: { name: string; version: string }[];
          error?: string;
        }>;
        installPackage: (packageName: string) => Promise<{
          success: boolean;
          output?: string;
          error?: string;
        }>;
        uninstallPackage: (packageName: string) => Promise<{
          success: boolean;
          output?: string;
          error?: string;
        }>;
        setWorkingDir: (dir: string | null) => Promise<{ success: boolean }>;
        getWorkingDir: () => Promise<{ success: boolean; dir: string | null }>;
        onOutput: (callback: (output: KernelOutput, msgId: string) => void) => () => void;
        onStateChange: (callback: (state: KernelState) => void) => () => void;
        onError: (callback: (error: string) => void) => () => void;
      };
      ai: {
        sync: (
          cellId: string,
          direction: string,
          context: {
            newContent: string;
            previousContent?: string;
            existingCounterpart?: string;
            cellsBefore?: CellContext[];
            cellsAfter?: CellContext[];
            proposedSymbols?: string[];
          }
        ) => Promise<{ success: boolean; result?: string; symbols?: GeneratedSymbol[]; notebookSymbols?: GeneratedSymbol[]; error?: string }>;
        explainOutput: (output: string, code: string) => Promise<{ success: boolean; result?: string; error?: string }>;
        suggestNextSteps: (output: string, code: string, description: string) => Promise<{ success: boolean; result?: string; error?: string }>;
        debugError: (error: string, code: string) => Promise<{ success: boolean; result?: string; error?: string }>;
        extractKeywords: (output: string, code: string) => Promise<{ success: boolean; keywords?: string[]; error?: string }>;
      };
      papers: {
        search: (keywords: string[]) => Promise<{ success: boolean; papers?: Paper[]; error?: string }>;
      };
      file: {
        open: () => Promise<string | undefined>;
        read: (path: string) => Promise<NotebookState>;
        save: (path: string, notebook: NotebookState) => Promise<{ success: boolean }>;
        saveAs: (notebook: NotebookState) => Promise<{ success: boolean; filePath: string | null }>;
        exportPython: (notebook: NotebookState) => Promise<{ success: boolean; filePath: string | null }>;
        listDir: (dirPath?: string) => Promise<{
          success: boolean;
          files: { name: string; isDirectory: boolean; path: string }[];
          cwd: string;
          error?: string;
        }>;
      };
      settings: {
        load: () => Promise<AppSettings>;
        save: (settings: AppSettings) => Promise<{ success: boolean }>;
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
        save: (notebookId: string, content: string, message: string) => Promise<{
          success: boolean;
          hash?: string;
          error?: string;
        }>;
        getHistory: (notebookId: string) => Promise<{
          success: boolean;
          history: Array<{ hash: string; message: string; timestamp: string }>;
          error?: string;
        }>;
        undo: (notebookId: string) => Promise<{
          success: boolean;
          content?: string;
          hash?: string;
          error?: string;
        }>;
        canUndo: (notebookId: string) => Promise<{
          success: boolean;
          canUndo: boolean;
          error?: string;
        }>;
        getVersion: (notebookId: string, hash: string) => Promise<{
          success: boolean;
          content?: string;
          error?: string;
        }>;
      };
      project: {
        readFile: (projectId: string, filePath: string) => Promise<{
          success: boolean;
          content?: string;
          error?: string;
        }>;
        getPath: (projectId: string) => Promise<{
          success: boolean;
          path?: string;
          error?: string;
        }>;
        listFiles: (projectId: string, relativePath?: string) => Promise<{
          success: boolean;
          files: { name: string; path: string; isDirectory: boolean }[];
          cwd: string;
          error?: string;
        }>;
      };
    };
  }
}

export {};
