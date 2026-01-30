import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  KernelManager,
  PythonSetup,
  type PythonEnvironment,
  type KernelOutput,
} from '@promptbook/core/kernel';
import log from 'electron-log/main';

// Python environment management
const pythonSetup = new PythonSetup();
let cachedEnvironments: PythonEnvironment[] = [];
let kernelManager: KernelManager | null = null;

// Scan for Python environments
export async function scanEnvironments(): Promise<PythonEnvironment[]> {
  cachedEnvironments = await pythonSetup.discoverEnvironments();
  return cachedEnvironments;
}

// Get kernel manager instance
export function getKernelManager(): KernelManager | null {
  return kernelManager;
}

// Get cached environments
export function getCachedEnvironments(): PythonEnvironment[] {
  return cachedEnvironments;
}

// Shutdown kernel (for app cleanup)
export async function shutdownKernel(): Promise<void> {
  if (kernelManager) {
    await kernelManager.shutdown();
  }
}

// Forward kernel events to renderer
export function setupKernelEventForwarding(mainWindow: BrowserWindow | null): void {
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

// Start kernel with environment
export async function startKernelWithEnvironment(
  pythonPath: string,
  mainWindow: BrowserWindow | null
): Promise<void> {
  const env = cachedEnvironments.find((e) => e.path === pythonPath);
  if (env) {
    try {
      kernelManager = new KernelManager(env.path);
      setupKernelEventForwarding(mainWindow);
      await kernelManager.start();
      mainWindow?.webContents.send('kernel:stateChange', kernelManager.getState());
      log.info('Kernel started with environment:', env.name);
    } catch (err) {
      log.error('Failed to start kernel:', err);
    }
  }
}

// Python code for getting variables
const GET_VARIABLES_CODE = `
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
    if t == 'ndarray':
        return f"ndarray{obj.shape}"
    if t == 'DataFrame':
        return f"DataFrame({obj.shape[0]}x{obj.shape[1]})"
    if t == 'Series':
        return f"Series({len(obj)})"
    return t

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

// Python code for getting all symbols (variables AND functions) for autocomplete
const GET_SYMBOLS_CODE = `
import json
import sys
import inspect

def _get_size_str(obj):
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

def _get_repr(obj, max_len=100):
    try:
        r = repr(obj)
        if len(r) > max_len:
            return r[:max_len] + "..."
        return r
    except:
        return "<unable to repr>"

def _get_type_name(obj):
    t = type(obj).__name__
    if t == 'ndarray':
        return f"ndarray{obj.shape}"
    if t == 'DataFrame':
        return f"DataFrame({obj.shape[0]}x{obj.shape[1]})"
    if t == 'Series':
        return f"Series({len(obj)})"
    return t

def _get_func_signature(func):
    try:
        sig = inspect.signature(func)
        return f"{func.__name__}{sig}"
    except:
        return f"{func.__name__}(...)"

def _get_func_docstring(func, max_len=100):
    try:
        doc = inspect.getdoc(func)
        if doc:
            first_line = doc.split('\\n')[0]
            if len(first_line) > max_len:
                return first_line[:max_len] + "..."
            return first_line
        return None
    except:
        return None

_symbols = []
_skip_names = {'In', 'Out', 'get_ipython', 'exit', 'quit', 'json', 'sys', 'inspect',
               '_get_size_str', '_get_repr', '_get_type_name', '_get_func_signature',
               '_get_func_docstring', '_symbols', '_skip_names'}

for name, value in list(globals().items()):
    if name.startswith('_'):
        continue
    if name in _skip_names:
        continue

    # Check if it's a user-defined function
    if callable(value) and not hasattr(value, '__self__'):
        val_type = type(value).__name__
        if val_type == 'function':
            _symbols.append({
                'name': name,
                'kind': 'function',
                'type': _get_func_signature(value),
                'description': _get_func_docstring(value) or 'User-defined function'
            })
            continue
        elif val_type in ['type', 'module', 'builtin_function_or_method']:
            continue

    # It's a variable
    _symbols.append({
        'name': name,
        'kind': 'variable',
        'type': _get_type_name(value),
        'description': _get_repr(value)
    })

print(json.dumps(_symbols))
`;

// Settings type with at least python config
interface KernelSettings {
  python: { selectedEnvironment?: string };
}

// Register basic kernel handlers (environments, status)
function registerBasicHandlers(): void {
  ipcMain.handle('kernel:getEnvironments', async () => cachedEnvironments);
  ipcMain.handle('kernel:scanEnvironments', async () => scanEnvironments());
  ipcMain.handle('kernel:testPython', async (_event, pythonPath: string) => {
    const hasIpykernel = await pythonSetup.checkIpykernel(pythonPath);
    return { success: true, hasIpykernel };
  });
  ipcMain.handle('kernel:installIpykernel', async (_event, pythonPath: string) => {
    const result = await pythonSetup.installIpykernel(pythonPath);
    if (result.success) await scanEnvironments();
    return result;
  });
  ipcMain.handle('kernel:createVenv', async (_event, venvName: string = '.venv') => {
    const result = await pythonSetup.createVenv(venvName);
    if (result.success) await scanEnvironments();
    return result;
  });
}

// Register execution handlers (execute, interrupt, restart, status)
function registerExecutionHandlers(): void {
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
    if (!kernelManager) return { success: false, error: 'No kernel running' };
    try {
      await kernelManager.interrupt();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('kernel:restart', async () => {
    if (!kernelManager) return { success: false, error: 'No kernel running' };
    try {
      await kernelManager.restart();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('kernel:getStatus', async () => {
    if (!kernelManager) return { state: 'disconnected', executionCount: 0 };
    return {
      state: kernelManager.getState(),
      executionCount: kernelManager.getExecutionCount(),
    };
  });

  ipcMain.handle('kernel:getVariables', async () => {
    if (!kernelManager) {
      return { success: false, error: 'No kernel running', variables: [] };
    }
    try {
      const result = await kernelManager.execute(GET_VARIABLES_CODE);
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

  ipcMain.handle('kernel:getSymbols', async () => {
    if (!kernelManager) {
      return { success: false, error: 'No kernel running', symbols: [] };
    }
    try {
      const result = await kernelManager.execute(GET_SYMBOLS_CODE);
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      if (stdoutOutput) {
        const symbols = JSON.parse(stdoutOutput.content.trim());
        return { success: true, symbols };
      }
      return { success: true, symbols: [] };
    } catch (err) {
      return { success: false, error: String(err), symbols: [] };
    }
  });
}

// Register environment selection handler
function registerSelectHandler(
  mainWindow: () => BrowserWindow | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSettings: (settings: any) => void,
  getCurrentSettings: () => KernelSettings
): void {
  ipcMain.handle('kernel:selectEnvironment', async (_event, pythonPath: string) => {
    try {
      if (kernelManager) await kernelManager.shutdown();

      const env = cachedEnvironments.find((e) => e.path === pythonPath);
      if (!env) return { success: false, error: 'Environment not found' };
      if (!env.hasIpykernel) {
        return { success: false, error: 'ipykernel not installed', needsInstall: true };
      }

      kernelManager = new KernelManager(pythonPath);
      setupKernelEventForwarding(mainWindow());
      await kernelManager.start();
      mainWindow()?.webContents.send('kernel:stateChange', kernelManager.getState());

      const currentSettings = getCurrentSettings();
      currentSettings.python.selectedEnvironment = pythonPath;
      saveSettings(currentSettings);

      return { success: true };
    } catch (err) {
      console.error('Error selecting environment:', err);
      return { success: false, error: String(err) };
    }
  });
}

export function registerKernelHandlers(
  mainWindow: () => BrowserWindow | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSettings: (settings: any) => void,
  getCurrentSettings: () => KernelSettings
): void {
  registerBasicHandlers();
  registerExecutionHandlers();
  registerSelectHandler(mainWindow, saveSettings, getCurrentSettings);
}
