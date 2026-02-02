import { ipcMain, BrowserWindow } from 'electron';
import {
  type AiSyncContext,
  type SyncDirection,
  createSyncProvider,
  buildExplainOutputPrompt,
  buildSuggestNextStepsPrompt,
  buildDebugErrorPrompt,
  buildExtractKeywordsPrompt,
  runSyncOrchestrator,
  type ContentType,
  type SyncContext,
  type StreamChunk,
} from '@promptbook/core/sync';
import type { AiSettings, AiSyncResult, CellContext } from '@promptbook/core';
import { testEventService } from '../services/TestEventService';
import { searchPapers, type Paper } from '../services/PaperSearchService';

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

  // Streaming sync using orchestrator (new architecture)
  ipcMain.handle('ai:syncStream', async (event, params: {
    cellId: string;
    sourceType: ContentType;
    sourceContent: string;
    cellsBefore: CellContext[];
    cellsAfter: CellContext[];
    existingParameters: Record<string, string>;
    notebookSymbols?: string[];
    existingInstructions?: string;
    existingDetailed?: string;
    existingCode?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const { cellId, sourceType, sourceContent, ...contextParams } = params;

    const context: SyncContext = {
      cellsBefore: contextParams.cellsBefore || [],
      cellsAfter: contextParams.cellsAfter || [],
      existingParameters: contextParams.existingParameters || {},
      notebookSymbols: contextParams.notebookSymbols,
      existingInstructions: contextParams.existingInstructions,
      existingDetailed: contextParams.existingDetailed,
      existingCode: contextParams.existingCode,
    };

    try {
      // Get the browser window to send events
      const webContents = event.sender;

      // Run the orchestrator and stream chunks to renderer
      for await (const chunk of runSyncOrchestrator(sourceType, sourceContent, context)) {
        // Send streaming event to renderer
        webContents.send('ai:syncStreamEvent', { cellId, ...chunk });

        // If complete or error, we're done
        if (chunk.type === 'complete' || chunk.type === 'error') {
          break;
        }
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Send error event
      event.sender.send('ai:syncStreamEvent', {
        cellId,
        type: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  });

  // Research assistant: Explain output
  ipcMain.handle('ai:explainOutput', async (_event, output: string, code: string): Promise<{ success: boolean; result?: string; error?: string }> => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };
      const provider = createSyncProvider(aiSettings);

      const prompt = buildExplainOutputPrompt(output, code);
      const result = await provider.sync('codeAssist' as SyncDirection, {
        newContent: prompt,
        existingCounterpart: code,
      });

      if (result.success && result.result) {
        return { success: true, result: result.result };
      }
      return { success: false, error: result.error || 'Failed to explain output' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Research assistant: Suggest next steps
  ipcMain.handle('ai:suggestNextSteps', async (_event, output: string, code: string, description: string): Promise<{ success: boolean; result?: string; error?: string }> => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };
      const provider = createSyncProvider(aiSettings);

      const prompt = buildSuggestNextStepsPrompt(output, code, description);
      const result = await provider.sync('codeAssist' as SyncDirection, {
        newContent: prompt,
        existingCounterpart: code,
      });

      if (result.success && result.result) {
        return { success: true, result: result.result };
      }
      return { success: false, error: result.error || 'Failed to suggest next steps' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Research assistant: Debug error
  ipcMain.handle('ai:debugError', async (_event, error: string, code: string): Promise<{ success: boolean; result?: string; error?: string }> => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };
      const provider = createSyncProvider(aiSettings);

      const prompt = buildDebugErrorPrompt(error, code);
      const result = await provider.sync('codeAssist' as SyncDirection, {
        newContent: prompt,
        existingCounterpart: code,
      });

      if (result.success && result.result) {
        return { success: true, result: result.result };
      }
      return { success: false, error: result.error || 'Failed to debug error' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Research assistant: Extract keywords for paper search
  ipcMain.handle('ai:extractKeywords', async (_event, output: string, code: string): Promise<{ success: boolean; keywords?: string[]; error?: string }> => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };
      const provider = createSyncProvider(aiSettings);

      const prompt = buildExtractKeywordsPrompt(output, code);
      const result = await provider.sync('codeAssist' as SyncDirection, {
        newContent: prompt,
        existingCounterpart: code,
      });

      if (result.success && result.result) {
        try {
          // Parse the JSON array from the response
          const keywords = JSON.parse(result.result);
          if (Array.isArray(keywords)) {
            return { success: true, keywords };
          }
        } catch {
          // If JSON parsing fails, try to extract keywords from plain text
          const keywords = result.result
            .split(/[,\n]/)
            .map((k: string) => k.replace(/^[\s\d.-]+|["'[\]]+/g, '').trim())
            .filter((k: string) => k.length > 0)
            .slice(0, 5);
          return { success: true, keywords };
        }
      }
      return { success: false, error: result.error || 'Failed to extract keywords' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Paper search via Semantic Scholar
  ipcMain.handle('papers:search', async (_event, keywords: string[]): Promise<{ success: boolean; papers?: Paper[]; error?: string }> => {
    try {
      const papers = await searchPapers(keywords, 10);
      return { success: true, papers };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });
}
