import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { kernelService } from '../services/KernelService';
import { testEventService } from '../services/TestEventService';

// Settings type with at least python config
interface KernelSettings {
  python: { selectedEnvironment?: string };
}

// Legacy exports for backward compatibility
export async function scanEnvironments() {
  return kernelService.scanEnvironments();
}

export function getKernelManager() {
  // Note: Direct access to KernelManager is deprecated
  // Use kernelService methods instead
  return null;
}

export function getCachedEnvironments() {
  return kernelService.getEnvironments();
}

export async function shutdownKernel() {
  return kernelService.shutdown();
}

export function setupKernelEventForwarding(mainWindow: BrowserWindow | null) {
  kernelService.setMainWindow(() => mainWindow);
}

export async function startKernelWithEnvironment(
  pythonPath: string,
  mainWindow: BrowserWindow | null
) {
  kernelService.setMainWindow(() => mainWindow);
  await kernelService.selectEnvironment(pythonPath);
}

// Register basic kernel handlers (environments, status)
function registerBasicHandlers(): void {
  ipcMain.handle('kernel:getEnvironments', async () => kernelService.getEnvironments());
  ipcMain.handle('kernel:scanEnvironments', async () => kernelService.scanEnvironments());
  ipcMain.handle('kernel:testPython', async (_event, pythonPath: string) => {
    const hasIpykernel = await kernelService.checkIpykernel(pythonPath);
    return { success: true, hasIpykernel };
  });
  ipcMain.handle('kernel:installIpykernel', async (_event, pythonPath: string) => {
    return kernelService.installIpykernel(pythonPath);
  });
  ipcMain.handle('kernel:createVenv', async (_event, venvName: string = '.venv') => {
    return kernelService.createVenv(venvName);
  });
}

// Register execution handlers (execute, interrupt, restart, status)
function registerExecutionHandlers(): void {
  ipcMain.handle('kernel:execute', async (_event, code: string) => {
    const startTime = Date.now();
    const result = await kernelService.execute(code);

    // Emit test events for kernel execution
    if (result.success && result.msgId) {
      testEventService.emitTestEvent('kernel:execute:start', {
        code,
        msgId: result.msgId,
      });

      testEventService.emitTestEvent('kernel:execute:complete', {
        msgId: result.msgId,
        outputs: result.outputs || [],
        durationMs: Date.now() - startTime,
      });
    }

    return result;
  });

  ipcMain.handle('kernel:interrupt', async () => {
    return kernelService.interrupt();
  });

  ipcMain.handle('kernel:restart', async () => {
    return kernelService.restart();
  });

  ipcMain.handle('kernel:getStatus', async () => {
    return kernelService.getStatus();
  });

  ipcMain.handle('kernel:getVariables', async () => {
    return kernelService.getVariables();
  });

  ipcMain.handle('kernel:getSymbols', async () => {
    return kernelService.getSymbols();
  });

  ipcMain.handle('kernel:listPackages', async () => {
    return kernelService.listPackages();
  });

  ipcMain.handle('kernel:installPackage', async (_event, packageName: string) => {
    return kernelService.installPackage(packageName);
  });

  ipcMain.handle('kernel:uninstallPackage', async (_event, packageName: string) => {
    return kernelService.uninstallPackage(packageName);
  });

  ipcMain.handle('kernel:setWorkingDir', async (_event, dir: string | null) => {
    return kernelService.setWorkingDir(dir);
  });

  ipcMain.handle('kernel:getWorkingDir', async () => {
    return { success: true, dir: kernelService.getWorkingDir() };
  });
}

// Register environment selection handler
function registerSelectHandler(
  mainWindow: () => BrowserWindow | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSettings: (settings: any) => void,
  getCurrentSettings: () => KernelSettings
): void {
  // Set the main window reference for IPC forwarding
  kernelService.setMainWindow(mainWindow);

  ipcMain.handle('kernel:selectEnvironment', async (_event, pythonPath: string) => {
    const result = await kernelService.selectEnvironment(pythonPath);

    if (result.success) {
      // Persist the selected environment
      const currentSettings = getCurrentSettings();
      currentSettings.python.selectedEnvironment = pythonPath;
      saveSettings(currentSettings);
    }

    return result;
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
