import { ipcMain } from 'electron';
import {
  type AiSyncContext,
  type SyncDirection,
  createSyncProvider,
  buildExplainOutputPrompt,
  buildSuggestNextStepsPrompt,
  buildDebugErrorPrompt,
  buildExtractKeywordsPrompt,
  buildOrchestratorPrompt,
  parseOrchestratorResponse,
  buildGenerateCellsPrompt,
  type ContentType,
  type SyncContext,
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

  // Streaming sync using Claude Agent SDK
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

      // Build the prompt using the core library
      const prompt = buildOrchestratorPrompt(sourceType, sourceContent, context);

      // Dynamic import of claude-agent-sdk (ESM module)
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      let result = '';

      // Use the Claude Agent SDK query function
      // It handles Bedrock auth via .claude/settings.json when CLAUDE_CODE_USE_BEDROCK=1
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
          // Enable streaming events
          includePartialMessages: true,
        },
      })) {
        // Handle streaming events (partial messages)
        if (message.type === 'stream_event' && 'event' in message) {
          const streamEvent = message as { type: 'stream_event'; event: { type: string; delta?: { type: string; text?: string; thinking?: string } } };
          const evt = streamEvent.event;

          if (evt.type === 'content_block_delta' && evt.delta) {
            if (evt.delta.type === 'text_delta' && evt.delta.text) {
              webContents.send('ai:syncStreamEvent', { cellId, type: 'content', content: evt.delta.text });
            }
            if (evt.delta.type === 'thinking_delta' && evt.delta.thinking) {
              webContents.send('ai:syncStreamEvent', { cellId, type: 'thinking', content: evt.delta.thinking });
            }
          }
        }

        // Collect the final result
        if (message.type === 'result') {
          result = (message as { type: 'result'; result: string }).result;
        }
      }

      if (!result) {
        throw new Error('No result from Claude Agent SDK');
      }

      // Parse the response using the core library
      const alignedResults = parseOrchestratorResponse(result);

      // Send complete event
      webContents.send('ai:syncStreamEvent', {
        cellId,
        type: 'complete',
        result: {
          content: JSON.stringify(alignedResults),
          parameters: alignedResults.unifiedParameters,
          symbolMentions: [],
          rawResponse: result,
        },
      });

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

  // Generate multiple cells from a description (streaming)
  ipcMain.handle('ai:generateCells', async (event, params: {
    description: string;
    fileContents?: Record<string, string>;
    existingCells?: { shortDescription?: string; code?: string }[];
  }): Promise<{ success: boolean; error?: string }> => {
    const { description, fileContents, existingCells } = params;

    try {
      const webContents = event.sender;
      const prompt = buildGenerateCellsPrompt(description, fileContents, existingCells);

      // Dynamic import of claude-agent-sdk (ESM module)
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      let result = '';

      for await (const message of query({
        prompt,
        options: {
          tools: [],
          permissionMode: 'bypassPermissions',
          maxTurns: 1,
          persistSession: false,
          includePartialMessages: true,
        },
      })) {
        // Handle streaming events
        if (message.type === 'stream_event' && 'event' in message) {
          const streamEvent = message as { type: 'stream_event'; event: { type: string; delta?: { type: string; text?: string } } };
          const evt = streamEvent.event;

          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            webContents.send('ai:generateCellsStream', { type: 'content', content: evt.delta.text });
          }
        }

        if (message.type === 'result') {
          result = (message as { type: 'result'; result: string }).result;
        }
      }

      if (!result) {
        throw new Error('No result from Claude Agent SDK');
      }

      // Parse the JSON array of cells
      let cells;
      try {
        // Try to extract JSON array from the response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cells = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseErr) {
        throw new Error(`Failed to parse cell generation response: ${parseErr}`);
      }

      // Send complete event with parsed cells
      webContents.send('ai:generateCellsStream', { type: 'complete', cells });

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      event.sender.send('ai:generateCellsStream', { type: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });
}
