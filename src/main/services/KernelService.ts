import type { BrowserWindow } from 'electron';
import {
  KernelManager,
  PythonSetup,
} from '@promptbook/core/kernel';
import type {
  KernelOutput,
  KernelState,
  PythonEnvironment,
} from '@promptbook/core';
import log from 'electron-log/main';

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

type OutputCallback = (output: KernelOutput, msgId: string) => void;
type StateCallback = (state: KernelState) => void;
type ErrorCallback = (error: Error) => void;

/**
 * KernelService encapsulates kernel lifecycle management.
 * Provides a clean interface for environment scanning, kernel operations, and event forwarding.
 */
export class KernelService {
  private kernelManager: KernelManager | null = null;
  private pythonSetup: PythonSetup;
  private cachedEnvironments: PythonEnvironment[] = [];
  private mainWindow: (() => BrowserWindow | null) | null = null;

  private outputCallbacks: OutputCallback[] = [];
  private stateCallbacks: StateCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  constructor(workspaceDir?: string) {
    this.pythonSetup = new PythonSetup(workspaceDir);
  }

  /**
   * Set the main window for event forwarding via IPC
   */
  setMainWindow(getWindow: () => BrowserWindow | null): void {
    this.mainWindow = getWindow;
  }

  /**
   * Scan for available Python environments
   */
  async scanEnvironments(): Promise<PythonEnvironment[]> {
    this.cachedEnvironments = await this.pythonSetup.discoverEnvironments();
    return this.cachedEnvironments;
  }

  /**
   * Get cached environments without rescanning
   */
  getEnvironments(): PythonEnvironment[] {
    return this.cachedEnvironments;
  }

  /**
   * Check if a Python path has ipykernel installed
   */
  async checkIpykernel(pythonPath: string): Promise<boolean> {
    return this.pythonSetup.checkIpykernel(pythonPath);
  }

  /**
   * Install ipykernel in the specified Python environment
   */
  async installIpykernel(pythonPath: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.pythonSetup.installIpykernel(pythonPath);
    if (result.success) {
      await this.scanEnvironments();
    }
    return result;
  }

  /**
   * Create a new virtual environment
   */
  async createVenv(venvName: string = '.venv'): Promise<{ success: boolean; pythonPath?: string; error?: string }> {
    const result = await this.pythonSetup.createVenv(venvName);
    if (result.success) {
      await this.scanEnvironments();
    }
    return result;
  }

  /**
   * Select and start a kernel with the specified Python environment
   */
  async selectEnvironment(pythonPath: string): Promise<{ success: boolean; error?: string; needsInstall?: boolean }> {
    try {
      // Shutdown existing kernel if any
      if (this.kernelManager) {
        await this.kernelManager.shutdown();
      }

      const env = this.cachedEnvironments.find((e) => e.path === pythonPath);
      if (!env) {
        return { success: false, error: 'Environment not found' };
      }
      if (!env.hasIpykernel) {
        return { success: false, error: 'ipykernel not installed', needsInstall: true };
      }

      this.kernelManager = new KernelManager(pythonPath);
      this.setupEventForwarding();
      await this.kernelManager.start();

      const state = this.kernelManager.getState();
      this.notifyStateChange(state);

      log.info('Kernel started with environment:', env.name);
      return { success: true };
    } catch (err) {
      log.error('Error selecting environment:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Execute code in the kernel
   */
  async execute(code: string): Promise<{ success: boolean; msgId?: string; outputs?: KernelOutput[]; error?: string; needsEnvironment?: boolean }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running', needsEnvironment: true };
    }
    try {
      const result = await this.kernelManager.execute(code);
      return { success: true, msgId: result.msgId, outputs: result.outputs };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Interrupt current execution
   */
  async interrupt(): Promise<{ success: boolean; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running' };
    }
    try {
      await this.kernelManager.interrupt();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Restart the kernel
   */
  async restart(): Promise<{ success: boolean; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running' };
    }
    try {
      await this.kernelManager.restart();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Shutdown the kernel
   */
  async shutdown(): Promise<void> {
    if (this.kernelManager) {
      await this.kernelManager.shutdown();
      this.kernelManager = null;
    }
  }

  /**
   * Get current kernel state
   */
  getState(): KernelState {
    return this.kernelManager?.getState() ?? 'disconnected';
  }

  /**
   * Get current execution count
   */
  getExecutionCount(): number {
    return this.kernelManager?.getExecutionCount() ?? 0;
  }

  /**
   * Get status object with state and execution count
   */
  getStatus(): { state: KernelState; executionCount: number } {
    return {
      state: this.getState(),
      executionCount: this.getExecutionCount(),
    };
  }

  /**
   * Get variables from the kernel namespace
   */
  async getVariables(): Promise<{ success: boolean; variables: unknown[]; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running', variables: [] };
    }
    try {
      const result = await this.kernelManager.execute(GET_VARIABLES_CODE);
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      if (stdoutOutput) {
        const variables = JSON.parse(stdoutOutput.content.trim());
        return { success: true, variables };
      }
      return { success: true, variables: [] };
    } catch (err) {
      return { success: false, error: String(err), variables: [] };
    }
  }

  /**
   * Get all symbols (variables and functions) from the kernel namespace
   */
  async getSymbols(): Promise<{ success: boolean; symbols: unknown[]; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running', symbols: [] };
    }
    try {
      const result = await this.kernelManager.execute(GET_SYMBOLS_CODE);
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      if (stdoutOutput) {
        const symbols = JSON.parse(stdoutOutput.content.trim());
        return { success: true, symbols };
      }
      return { success: true, symbols: [] };
    } catch (err) {
      return { success: false, error: String(err), symbols: [] };
    }
  }

  /**
   * List installed packages in the current environment
   */
  async listPackages(): Promise<{ success: boolean; packages: { name: string; version: string }[]; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running', packages: [] };
    }
    try {
      const code = `
import subprocess
import json
import sys
result = subprocess.run([sys.executable, '-m', 'pip', 'list', '--format=json'], capture_output=True, text=True)
print(result.stdout)
`;
      const result = await this.kernelManager.execute(code);
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      if (stdoutOutput) {
        const packages = JSON.parse(stdoutOutput.content.trim());
        return { success: true, packages };
      }
      return { success: true, packages: [] };
    } catch (err) {
      return { success: false, error: String(err), packages: [] };
    }
  }

  /**
   * Install a package using pip
   */
  async installPackage(packageName: string): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running' };
    }
    // Validate package name to prevent command injection
    if (!/^[a-zA-Z0-9_\-.[\]]+$/.test(packageName) || packageName.length > 100) {
      return { success: false, error: 'Invalid package name' };
    }
    try {
      const code = `
import subprocess
import sys
result = subprocess.run([sys.executable, '-m', 'pip', 'install', '${packageName}'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
if result.returncode != 0:
    raise Exception(f"pip install failed with code {result.returncode}")
`;
      const result = await this.kernelManager.execute(code);
      const hasError = result.outputs.some(o => o.type === 'error');
      if (hasError) {
        const errorOutput = result.outputs.find(o => o.type === 'error');
        return { success: false, error: errorOutput?.content || 'Installation failed' };
      }
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      return { success: true, output: stdoutOutput?.content || '' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Uninstall a package using pip
   */
  async uninstallPackage(packageName: string): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.kernelManager) {
      return { success: false, error: 'No kernel running' };
    }
    // Validate package name to prevent command injection
    if (!/^[a-zA-Z0-9_\-.[\]]+$/.test(packageName) || packageName.length > 100) {
      return { success: false, error: 'Invalid package name' };
    }
    try {
      const code = `
import subprocess
import sys
result = subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '${packageName}'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
if result.returncode != 0:
    raise Exception(f"pip uninstall failed with code {result.returncode}")
`;
      const result = await this.kernelManager.execute(code);
      const hasError = result.outputs.some(o => o.type === 'error');
      if (hasError) {
        const errorOutput = result.outputs.find(o => o.type === 'error');
        return { success: false, error: errorOutput?.content || 'Uninstall failed' };
      }
      const stdoutOutput = result.outputs.find(o => o.type === 'stdout');
      return { success: true, output: stdoutOutput?.content || '' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // Event subscription methods

  /**
   * Subscribe to kernel output events
   */
  onOutput(callback: OutputCallback): () => void {
    this.outputCallbacks.push(callback);
    return () => {
      const index = this.outputCallbacks.indexOf(callback);
      if (index !== -1) {
        this.outputCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to kernel state change events
   */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index !== -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to kernel error events
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index !== -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  // Private methods

  private setupEventForwarding(): void {
    if (!this.kernelManager) return;

    this.kernelManager.on('output', (output: KernelOutput, msgId: string) => {
      // Notify callbacks
      for (const callback of this.outputCallbacks) {
        callback(output, msgId);
      }
      // Forward to renderer via IPC
      const window = this.mainWindow?.();
      window?.webContents.send('kernel:output', output, msgId);
    });

    this.kernelManager.on('stateChange', (state: KernelState) => {
      this.notifyStateChange(state);
    });

    this.kernelManager.on('error', (error: Error) => {
      // Notify callbacks
      for (const callback of this.errorCallbacks) {
        callback(error);
      }
      // Forward to renderer via IPC
      const window = this.mainWindow?.();
      window?.webContents.send('kernel:error', error.message);
    });
  }

  private notifyStateChange(state: KernelState): void {
    // Notify callbacks
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
    // Forward to renderer via IPC
    const window = this.mainWindow?.();
    window?.webContents.send('kernel:stateChange', state);
  }
}

// Export singleton instance
export const kernelService = new KernelService();
