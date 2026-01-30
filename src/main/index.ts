import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import { KernelManager, PythonSetup, PythonEnvironment, KernelOutput } from './kernel';

// Settings file path
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');

// Default settings
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
}

const defaultSettings: AppSettings = {
  python: {},
  ai: { provider: 'agent' },
  kernel: { startupTimeout: 30000 },
};

// Load settings
async function loadSettings(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(getSettingsPath(), 'utf-8');
    return { ...defaultSettings, ...JSON.parse(content) };
  } catch {
    return defaultSettings;
  }
}

// Save settings
async function saveSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2));
}

// Current settings (cached)
let currentSettings = defaultSettings;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
  currentSettings = await loadSettings();
  createWindow();

  // Scan for environments in background
  scanEnvironments().catch(console.error);

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
      } catch (err) {
        console.error('Failed to start kernel:', err);
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

Update the instructions to accurately describe what the new code does. Make MINIMAL changes - only modify what's necessary to reflect the code changes.

Return ONLY the updated instructions, no code or markdown.`;
    } else if (hasExistingInstructions) {
      // Existing instructions as reference
      return `You are generating instructions for Python code. There are existing instructions that may be relevant.

CODE:
\`\`\`python
${newContent}
\`\`\`

EXISTING INSTRUCTIONS (use as reference for style):
${existingCounterpart}

Describe what the code does in clear, concise instructions. If the existing instructions are close to accurate, make minimal modifications.

Return ONLY the instructions, no code or markdown.`;
    } else {
      // Fresh generation
      return `Describe what this Python code does in clear, concise instructions.

Return ONLY the description, no code or markdown.

CODE:
\`\`\`python
${newContent}
\`\`\``;
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
  await saveSettings(settings);
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
