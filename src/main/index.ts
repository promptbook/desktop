import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

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

app.whenReady().then(createWindow);

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

// IPC handlers
ipcMain.handle('kernel:execute', async (_event, code: string) => {
  return { success: true, output: 'Kernel not yet implemented' };
});

ipcMain.handle('ai:sync', async (_event, cellId: string, direction: string) => {
  return { success: true };
});

ipcMain.handle('file:open', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'Promptbook', extensions: ['promptbook'] }],
  });
  return result.filePaths[0];
});

ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
  const fs = await import('fs/promises');
  await fs.writeFile(filePath, content);
  return { success: true };
});
