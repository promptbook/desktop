import { app, BrowserWindow, ipcMain, session, Menu, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import { KernelManager, PythonSetup, PythonEnvironment, KernelOutput } from './kernel';

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

// Helper to import ESM modules in CommonJS context
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)');

// AI sync context type
interface AiSyncContext {
  newContent: string;
  previousContent?: string;
  existingCounterpart?: string;
}

// Build smart prompt based on context
function buildSyncPrompt(direction: string, context: AiSyncContext): string {
  const { newContent, previousContent, existingCounterpart } = context;

  // Handle expand/shorten instructions
  if (direction === 'expandInstructions') {
    return `Expand these instructions with more detail while keeping the same meaning.
Keep parameters in {{name:value}} format. Add context about what each step does.

Current instructions:
${newContent}

Return ONLY the expanded instructions, no code or markdown.`;
  }

  if (direction === 'shortenInstructions') {
    return `Make these instructions more concise (1 short sentence preferred).
Keep parameters in {{name:value}} format. Remove unnecessary words.
Don't mention "Python" or "code" - it's obvious.
Use action words: "Generate", "Calculate", "Plot", etc.

Current instructions:
${newContent}

Return ONLY the shortened instructions, no code or markdown.`;
  }
  const hasExistingCode = direction === 'toCode' && existingCounterpart?.trim();
  const hasExistingInstructions = direction === 'toInstructions' && existingCounterpart?.trim();
  const hasChanges = previousContent && previousContent !== newContent;

  if (direction === 'toCode') {
    if (hasExistingCode && hasChanges) {
      // Incremental update: instructions changed, update existing code
      return `You are updating Python code based on changed instructions.

PREVIOUS INSTRUCTIONS:
${previousContent}

NEW INSTRUCTIONS:
${newContent}

CURRENT CODE:
\`\`\`python
${existingCounterpart}
\`\`\`

Update the code to reflect the new instructions. Make MINIMAL changes - only modify what's necessary to implement the changes. Keep the code structure, variable names, and style consistent with the existing code unless the changes require otherwise.

Return ONLY the updated Python code, no explanations or markdown.`;
    } else if (hasExistingCode) {
      // Existing code but no tracked changes - still use it as reference
      return `You are generating Python code for a task. There is existing code that may be relevant.

INSTRUCTIONS:
${newContent}

EXISTING CODE (use as reference for style/structure):
\`\`\`python
${existingCounterpart}
\`\`\`

Generate code that implements the instructions. If the existing code is close to what's needed, make minimal modifications. Otherwise, write new code following the same coding style.

Return ONLY the Python code, no explanations or markdown.`;
    } else {
      // Fresh generation
      return `Generate Python code for the following task. Write clean, efficient, and well-structured code.

Return ONLY the Python code, no explanations or markdown.

TASK:
${newContent}`;
    }
  } else {
    // toInstructions
    const conciseGuidelines = `
IMPORTANT GUIDELINES FOR INSTRUCTIONS:
- Be EXTREMELY concise (1 short sentence preferred)
- Don't mention "Python" or "code" - it's obvious
- Use action words: "Generate", "Calculate", "Plot", "Load", etc.
- Include key parameters as {{parameter_name:value}} placeholders
- Example: "Generate the first {{count:10}} Fibonacci numbers starting at {{start:0}}"
- Example: "Plot {{metric:temperature}} over {{period:last 7 days}}"
- Example: "Calculate {{operation:sum}} of {{numbers:1, 2, 3, 4, 5}}"`;

    if (hasExistingInstructions && hasChanges) {
      // Code changed, update existing instructions
      return `You are updating instructions based on changed code.

PREVIOUS CODE:
\`\`\`python
${previousContent}
\`\`\`

NEW CODE:
\`\`\`python
${newContent}
\`\`\`

CURRENT INSTRUCTIONS:
${existingCounterpart}
${conciseGuidelines}

Update the instructions to accurately describe what the new code does. Make MINIMAL changes.

Return ONLY the updated instructions, no code or markdown.`;
    } else if (hasExistingInstructions) {
      // Existing instructions as reference
      return `You are generating instructions for code. There are existing instructions that may be relevant.

CODE:
\`\`\`python
${newContent}
\`\`\`

EXISTING INSTRUCTIONS (use as reference for style):
${existingCounterpart}
${conciseGuidelines}

Return ONLY the instructions, no code or markdown.`;
    } else {
      // Fresh generation
      return `Describe what this code does in a concise instruction.
${conciseGuidelines}

CODE:
\`\`\`python
${newContent}
\`\`\`

Return ONLY the instruction, no code or markdown.`;
    }
  }
}

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
    if (direction === 'toCode') {
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
    if (direction === 'toCode') {
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
