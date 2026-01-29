import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('promptbook', {
  kernel: {
    execute: (code: string) => ipcRenderer.invoke('kernel:execute', code),
  },
  ai: {
    sync: (cellId: string, direction: string) =>
      ipcRenderer.invoke('ai:sync', cellId, direction),
  },
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (filePath: string, content: string) =>
      ipcRenderer.invoke('file:save', filePath, content),
  },
});
