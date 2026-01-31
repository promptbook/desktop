import { ipcMain } from 'electron';
import { type AiSyncContext, type SyncDirection, createSyncProvider } from '@promptbook/core/sync';
import type { AiSettings, AiSyncResult } from '@promptbook/core';
import { testEventService } from '../services/TestEventService';

export function registerAiHandlers(getCurrentSettings: () => { ai?: AiSettings }): void {
  ipcMain.handle('ai:sync', async (_event, cellId: string, direction: SyncDirection, context: AiSyncContext): Promise<AiSyncResult> => {
    const startTime = Date.now();

    // Emit test event for LLM request
    testEventService.emitTestEvent('llm:request', {
      cellId,
      direction,
      context,
    });

    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };

      try {
        const provider = createSyncProvider(aiSettings);
        const result = await provider.sync(direction, context);

        // Emit test event for LLM response
        testEventService.emitTestEvent('llm:response', {
          cellId,
          direction,
          result,
          durationMs: Date.now() - startTime,
        });

        return result;
      } catch (err) {
        // Handle unimplemented providers gracefully
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('not yet implemented')) {
          testEventService.emitTestEvent('llm:error', {
            cellId,
            direction,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
        throw err;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Emit test event for LLM error
      testEventService.emitTestEvent('llm:error', {
        cellId,
        direction,
        error: errorMessage,
      });

      return { success: false, error: `AI Error: ${errorMessage}` };
    }
  });
}
