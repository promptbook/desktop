import { app, BrowserWindow, ipcMain, session, Menu, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import {
  KernelManager,
  PythonSetup,
  type PythonEnvironment,
  type KernelOutput,
} from '@promptbook/core/kernel';
import { buildSyncPrompt, type AiSyncContext } from '@promptbook/core/sync';
import { versionManager } from './kernel/VersionManager';

// Electron plugins
import log from 'electron-log/main';
import Store from 'electron-store';
import windowStateKeeper from 'electron-window-state';
import contextMenu from 'electron-context-menu';

// ============================================
// Logging Setup
// ============================================
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Replace console with electron-log
Object.assign(console, log.functions);

log.info('Promptbook starting...');

// ============================================
// Settings with electron-store
// ============================================
interface AppSettings {
  python: { selectedEnvironment?: string };
  ai: {
    provider: 'agent' | 'claude' | 'bedrock' | 'openai' | 'ollama';
    claudeApiKey?: string;
    openaiApiKey?: string;
    bedrockRegion?: string;
    bedrockProfile?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };
  kernel: { startupTimeout: number };
  spellcheck: { enabled: boolean; languages: string[] };
}

const defaultSettings: AppSettings = {
  python: {},
  ai: { provider: 'agent' },
  kernel: { startupTimeout: 30000 },
  spellcheck: { enabled: true, languages: ['en-US'] },
};

// Persistent store with electron-store
const store = new Store<AppSettings>({
  defaults: defaultSettings,
  name: 'promptbook-settings',
});

// Get current settings
function getSettings(): AppSettings {
  return {
    python: store.get('python', defaultSettings.python),
    ai: store.get('ai', defaultSettings.ai),
    kernel: store.get('kernel', defaultSettings.kernel),
    spellcheck: store.get('spellcheck', defaultSettings.spellcheck),
  };
}

// Save settings
function saveSettings(settings: AppSettings): void {
  store.set('python', settings.python);
  store.set('ai', settings.ai);
  store.set('kernel', settings.kernel);
  store.set('spellcheck', settings.spellcheck);
  log.info('Settings saved');
}

// Current settings (cached)
let currentSettings = getSettings();

// Python environment management
const pythonSetup = new PythonSetup();
let cachedEnvironments: PythonEnvironment[] = [];
let kernelManager: KernelManager | null = null;

// Scan for Python environments
async function scanEnvironments(): Promise<PythonEnvironment[]> {
  cachedEnvironments = await pythonSetup.discoverEnvironments();
  return cachedEnvironments;
}

let mainWindow: BrowserWindow | null = null;
let mainWindowState: ReturnType<typeof windowStateKeeper> | null = null;

// ============================================
// Context Menu Setup
// ============================================
function setupContextMenu() {
  contextMenu({
    showSaveImageAs: true,
    showCopyImage: true,
    showCopyImageAddress: true,
    showInspectElement: process.env.NODE_ENV === 'development',
    showSearchWithGoogle: false,
    prepend: (_defaultActions, parameters, browserWindow) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = [];

      // Get webContents safely
      const getWebContents = () => {
        if (!browserWindow) return null;
        if ('webContents' in browserWindow) {
          return (browserWindow as BrowserWindow).webContents;
        }
        return null;
      };

      // Spell check suggestions
      if (parameters.misspelledWord) {
        menuItems.push({
          label: `Add "${parameters.misspelledWord}" to dictionary`,
          click: () => {
            const webContents = getWebContents();
            webContents?.session.addWordToSpellCheckerDictionary(parameters.misspelledWord);
          },
        });
        menuItems.push({ type: 'separator' });

        // Add suggestions
        if (parameters.dictionarySuggestions.length > 0) {
          parameters.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
            menuItems.push({
              label: suggestion,
              click: () => {
                const webContents = getWebContents();
                webContents?.replaceMisspelling(suggestion);
              },
            });
          });
          menuItems.push({ type: 'separator' });
        }
      }

      return menuItems;
    },
    labels: {
      copy: 'Copy',
      paste: 'Paste',
      cut: 'Cut',
      selectAll: 'Select All',
      copyLink: 'Copy Link',
      copyImage: 'Copy Image',
      saveImageAs: 'Save Image As...',
      inspect: 'Inspect Element',
    },
  });

  log.info('Context menu initialized');
}

// ============================================
// Spell Checker Setup
// ============================================
function setupSpellChecker() {
  const ses = session.defaultSession;
  const spellcheckSettings = currentSettings.spellcheck;

  if (spellcheckSettings.enabled) {
    ses.setSpellCheckerLanguages(spellcheckSettings.languages);
    log.info('Spell checker enabled with languages:', spellcheckSettings.languages);
  }
}

// ============================================
// Window Creation
// ============================================
function createWindow() {
  // Remember window size and position
  mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: currentSettings.spellcheck.enabled,
    },
  });

  // Track window state
  mainWindowState.manage(mainWindow);

  // Set up spell checker
  setupSpellChecker();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

// Forward kernel events to renderer
function setupKernelEventForwarding(): void {
  if (!kernelManager || !mainWindow) return;

  kernelManager.on('output', (output: KernelOutput, msgId: string) => {
    mainWindow?.webContents.send('kernel:output', output, msgId);
  });

  kernelManager.on('stateChange', (state: string) => {
    mainWindow?.webContents.send('kernel:stateChange', state);
  });

  kernelManager.on('error', (error: Error) => {
    mainWindow?.webContents.send('kernel:error', error.message);
  });
}

app.whenReady().then(async () => {
  log.info('App ready');

  // Load settings from store
  currentSettings = getSettings();

  // Set up context menu globally
  setupContextMenu();

  // Create main window
  createWindow();

  // Scan for environments in background
  scanEnvironments().catch((err) => log.error('Failed to scan environments:', err));

  // If we have a previously selected environment, try to start the kernel
  if (currentSettings.python.selectedEnvironment) {
    const env = cachedEnvironments.find(
      (e) => e.path === currentSettings.python.selectedEnvironment
    );
    if (env) {
      try {
        kernelManager = new KernelManager(env.path);
        setupKernelEventForwarding();
        await kernelManager.start();
        mainWindow?.webContents.send('kernel:stateChange', kernelManager.getState());
        log.info('Kernel started with environment:', env.name);
      } catch (err) {
        log.error('Failed to start kernel:', err);
      }
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (kernelManager) {
    await kernelManager.shutdown();
  }
});

// Kernel IPC handlers
ipcMain.handle('kernel:getEnvironments', async () => {
  return cachedEnvironments;
});

ipcMain.handle('kernel:scanEnvironments', async () => {
  return scanEnvironments();
});

ipcMain.handle('kernel:selectEnvironment', async (_event, pythonPath: string) => {
  try {
    // Shutdown existing kernel
    if (kernelManager) {
      await kernelManager.shutdown();
    }

    // Find the environment
    const env = cachedEnvironments.find((e) => e.path === pythonPath);
    if (!env) {
      return { success: false, error: 'Environment not found' };
    }

    // Check if ipykernel is installed
    if (!env.hasIpykernel) {
      return { success: false, error: 'ipykernel not installed', needsInstall: true };
    }

    // Start new kernel
    kernelManager = new KernelManager(pythonPath);
    // Set up event forwarding BEFORE starting so we catch all state changes
    setupKernelEventForwarding();
    await kernelManager.start();
    // Send current state to renderer in case events were missed
    mainWindow?.webContents.send('kernel:stateChange', kernelManager.getState());

    // Save the selection
    currentSettings.python.selectedEnvironment = pythonPath;
    await saveSettings(currentSettings);

    return { success: true };
  } catch (err) {
    console.error('Error selecting environment:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('kernel:installIpykernel', async (_event, pythonPath: string) => {
  const result = await pythonSetup.installIpykernel(pythonPath);
  if (result.success) {
    // Rescan environments to update hasIpykernel status
    await scanEnvironments();
  }
  return result;
});

ipcMain.handle('kernel:execute', async (_event, code: string) => {
  if (!kernelManager) {
    return { success: false, error: 'No kernel running', needsEnvironment: true };
  }

  try {
    const result = await kernelManager.execute(code);
    return { success: true, msgId: result.msgId, outputs: result.outputs };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('kernel:interrupt', async () => {
  if (!kernelManager) {
    return { success: false, error: 'No kernel running' };
  }

  try {
    await kernelManager.interrupt();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('kernel:restart', async () => {
  if (!kernelManager) {
    return { success: false, error: 'No kernel running' };
  }

  try {
    await kernelManager.restart();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('kernel:getStatus', async () => {
  if (!kernelManager) {
    return { state: 'disconnected', executionCount: 0 };
  }
  return {
    state: kernelManager.getState(),
    executionCount: kernelManager.getExecutionCount(),
  };
});

ipcMain.handle('kernel:testPython', async (_event, pythonPath: string) => {
  const hasIpykernel = await pythonSetup.checkIpykernel(pythonPath);
  return { success: true, hasIpykernel };
});

ipcMain.handle('kernel:createVenv', async (_event, venvName: string = '.venv') => {
  const result = await pythonSetup.createVenv(venvName);
  if (result.success) {
    // Rescan environments to include the new venv
    await scanEnvironments();
  }
  return result;
});

ipcMain.handle('kernel:getVariables', async () => {
  if (!kernelManager) {
    return { success: false, error: 'No kernel running', variables: [] };
  }

  // Python code to get all user-defined variables with their types and values
  const code = `
import json
import sys

def get_size_str(obj):
    try:
        size = sys.getsizeof(obj)
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"
    except:
        return None

def get_repr(obj, max_len=200):
    try:
        r = repr(obj)
        if len(r) > max_len:
            return r[:max_len] + "..."
        return r
    except:
        return "<unable to repr>"

def get_type_name(obj):
    t = type(obj).__name__
    # Add shape info for numpy arrays
    if t == 'ndarray':
        return f"ndarray{obj.shape}"
    # Add shape info for DataFrames
    if t == 'DataFrame':
        return f"DataFrame({obj.shape[0]}x{obj.shape[1]})"
    if t == 'Series':
        return f"Series({len(obj)})"
    return t

# Get all user-defined variables (exclude builtins and modules)
_vars = []
for name, value in list(globals().items()):
    if name.startswith('_'):
        continue
    if name in ['In', 'Out', 'get_ipython', 'exit', 'quit', 'json', 'sys', 'get_size_str', 'get_repr', 'get_type_name']:
        continue
    if callable(value) and not hasattr(value, '__self__'):
        if type(value).__name__ in ['function', 'type', 'module', 'builtin_function_or_method']:
            continue
    _vars.append({
        'name': name,
        'type': get_type_name(value),
        'value': get_repr(value),
        'size': get_size_str(value)
    })

print(json.dumps(_vars))
`;

  try {
    const result = await kernelManager.execute(code);
    // Find the stdout output that contains our JSON
    const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
    if (stdoutOutput) {
      const variables = JSON.parse(stdoutOutput.content.trim());
      return { success: true, variables };
    }
    return { success: true, variables: [] };
  } catch (err) {
    return { success: false, error: String(err), variables: [] };
  }
});

// Helper to import ESM modules in CommonJS context
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)');

// AI handlers - matching Wonderland's simple approach
async function aiSyncWithAgent(direction: string, context: AiSyncContext): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const { query } = await dynamicImport('@anthropic-ai/claude-agent-sdk');

    const prompt = buildSyncPrompt(direction, context);
    console.log('[AI Sync] Starting query');

    let result = '';

    // Use the Claude Agent SDK query function - same as Wonderland
    for await (const message of query({
      prompt,
      options: {
        // No tools needed - just text generation
        tools: [],
        // Bypass permissions since we're not using any tools
        permissionMode: 'bypassPermissions',
        // Limit to a single turn
        maxTurns: 1,
        // Don't persist the session
        persistSession: false,
        // Pass Bedrock environment variables
        env: {
          ...process.env,
          CLAUDE_CODE_USE_BEDROCK: '1',
          AWS_REGION: process.env.AWS_REGION || 'us-east-1',
        },
      },
    })) {
      // Collect the result text from result messages (same as Wonderland)
      if (message.type === 'result') {
        result = (message as { type: 'result'; result: string }).result;
      }
    }

    if (!result) {
      return { success: false, error: 'No response generated' };
    }

    // Clean up markdown code blocks (same as Wonderland)
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    if (isToCode) {
      // Handle ```python and ``` blocks
      const codeMatch = result.match(/```(?:python)?\s*([\s\S]*?)```/);
      if (codeMatch) {
        result = codeMatch[1];
      }
    }

    return { success: true, result: result.trim() };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Sync] Exception:', errorMessage);
    return { success: false, error: `Agent SDK Error: ${errorMessage}` };
  }
}

async function aiSyncWithClaude(direction: string, context: AiSyncContext): Promise<{ success: boolean; result?: string; error?: string }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const prompt = buildSyncPrompt(direction, context);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (textBlock && textBlock.type === 'text') {
    let result = textBlock.text;
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    if (isToCode) {
      result = result.replace(/^```python\n?/i, '').replace(/\n?```$/i, '');
      result = result.replace(/^```\n?/, '').replace(/\n?```$/i, '');
    }
    return { success: true, result: result.trim() };
  }

  return { success: false, error: 'No response generated' };
}

ipcMain.handle('ai:sync', async (_event, _cellId: string, direction: string, context: AiSyncContext) => {
  try {
    const provider = currentSettings.ai?.provider || 'agent';

    switch (provider) {
      case 'agent':
        return await aiSyncWithAgent(direction, context);

      case 'claude':
        return await aiSyncWithClaude(direction, context);

      case 'bedrock':
        // TODO: Implement Bedrock provider
        return { success: false, error: 'Bedrock provider not yet implemented' };

      case 'openai':
        // TODO: Implement OpenAI provider
        return { success: false, error: 'OpenAI provider not yet implemented' };

      case 'ollama':
        // TODO: Implement Ollama provider
        return { success: false, error: 'Ollama provider not yet implemented' };

      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: `AI Error: ${errorMessage}` };
  }
});

// Settings handlers
ipcMain.handle('settings:load', async () => {
  return currentSettings;
});

ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
  currentSettings = settings;
  saveSettings(settings);

  // Update spell checker if settings changed
  if (mainWindow) {
    const ses = session.defaultSession;
    if (settings.spellcheck?.enabled) {
      ses.setSpellCheckerLanguages(settings.spellcheck.languages);
    }
  }

  return { success: true };
});

// Clipboard handlers
ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard:write', (_event, text: string) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('clipboard:readHTML', () => {
  return clipboard.readHTML();
});

ipcMain.handle('clipboard:writeHTML', (_event, html: string) => {
  clipboard.writeHTML(html);
  return { success: true };
});

// Spell checker handlers
ipcMain.handle('spellcheck:getLanguages', () => {
  return session.defaultSession.getSpellCheckerLanguages();
});

ipcMain.handle('spellcheck:setLanguages', (_event, languages: string[]) => {
  session.defaultSession.setSpellCheckerLanguages(languages);
  currentSettings.spellcheck.languages = languages;
  saveSettings(currentSettings);
  return { success: true };
});

ipcMain.handle('spellcheck:addWord', (_event, word: string) => {
  session.defaultSession.addWordToSpellCheckerDictionary(word);
  log.info('Added word to dictionary:', word);
  return { success: true };
});

// File handlers

// List files in directory for @ autocomplete
ipcMain.handle('file:listDir', async (_event, dirPath?: string) => {
  try {
    const targetDir = dirPath || process.cwd();
    const entries = await fs.readdir(targetDir, { withFileTypes: true });

    const files: { name: string; isDirectory: boolean; path: string }[] = [];
    for (const entry of entries) {
      // Skip hidden files and common non-data directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
        continue;
      }
      files.push({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(targetDir, entry.name),
      });
    }

    // Sort: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return { success: true, files, cwd: targetDir };
  } catch (err) {
    return { success: false, error: String(err), files: [], cwd: process.cwd() };
  }
});

ipcMain.handle('file:open', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [
      { name: 'Promptbook', extensions: ['yaml', 'yml', 'promptbook'] },
    ],
  });
  return result.filePaths[0];
});

ipcMain.handle('file:read', async (_event, filePath: string) => {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content);
});

ipcMain.handle('file:save', async (_event, filePath: string, notebook: unknown) => {
  const content = yaml.stringify(notebook, {
    indent: 2,
    lineWidth: 120,
  });
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true };
});

ipcMain.handle('file:saveAs', async (_event, notebook: unknown) => {
  const { dialog } = await import('electron');

  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'Promptbook YAML', extensions: ['yaml'] },
    ],
    defaultPath: 'notebook.yaml',
  });

  if (result.canceled || !result.filePath) {
    return { success: false, filePath: null };
  }

  const content = yaml.stringify(notebook, {
    indent: 2,
    lineWidth: 120,
  });
  await fs.writeFile(result.filePath, content, 'utf-8');
  return { success: true, filePath: result.filePath };
});

// Export notebook as Python script
interface NotebookCell {
  cellType: 'code' | 'text';
  shortDescription?: string;
  fullDescription?: string;
  code?: string;
  textContent?: string;
}

interface NotebookExport {
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
  cells: NotebookCell[];
}

ipcMain.handle('file:exportPython', async (_event, notebook: NotebookExport) => {
  const { dialog } = await import('electron');

  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'Python Script', extensions: ['py'] },
    ],
    defaultPath: 'notebook.py',
  });

  if (result.canceled || !result.filePath) {
    return { success: false, filePath: null };
  }

  // Generate Python file content
  const lines: string[] = [];

  // Add header comment
  lines.push('#!/usr/bin/env python3');
  lines.push('"""');
  if (notebook.metadata?.title) {
    lines.push(notebook.metadata.title);
  } else {
    lines.push('Exported from Promptbook');
  }
  if (notebook.metadata?.author) {
    lines.push(`Author: ${notebook.metadata.author}`);
  }
  if (notebook.metadata?.created) {
    lines.push(`Created: ${notebook.metadata.created}`);
  }
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('"""');
  lines.push('');

  // Process each cell
  for (const cell of notebook.cells) {
    if (cell.cellType === 'text') {
      // Convert text cell to docstring/comment
      if (cell.textContent) {
        lines.push('# ' + cell.textContent.split('\n').join('\n# '));
        lines.push('');
      }
    } else if (cell.cellType === 'code') {
      // Add description as comment if available
      const description = cell.shortDescription || cell.fullDescription;
      if (description) {
        lines.push('# ' + description.split('\n').join('\n# '));
      }
      // Add the code
      if (cell.code) {
        lines.push(cell.code);
        lines.push('');
      }
    }
  }

  const content = lines.join('\n');
  await fs.writeFile(result.filePath, content, 'utf-8');
  return { success: true, filePath: result.filePath };
});

// ============================================
// Version Control IPC Handlers
// ============================================

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
