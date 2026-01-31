import { ipcMain } from 'electron';
import { type AiSyncContext, createSyncProvider } from '@promptbook/core/sync';
import type { AiSettings, AiSyncResult } from '@promptbook/core';

export function registerAiHandlers(getCurrentSettings: () => { ai?: AiSettings }): void {
  ipcMain.handle('ai:sync', async (_event, _cellId: string, direction: string, context: AiSyncContext): Promise<AiSyncResult> => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };

      try {
        const provider = createSyncProvider(aiSettings);
        return await provider.sync(direction, context);
      } catch (err) {
        // Handle unimplemented providers gracefully
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('not yet implemented')) {
          return { success: false, error: errorMessage };
        }
        throw err;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `AI Error: ${errorMessage}` };
    }
  });
}
