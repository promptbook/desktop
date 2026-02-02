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
    console.log('[ai:syncStream] Starting sync for cell:', cellId, 'sourceType:', sourceType);
    console.log('[ai:syncStream] Source content length:', sourceContent?.length);

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
      console.log('[ai:syncStream] Built prompt, length:', prompt.length);

      // Send thinking event
      webContents.send('ai:syncStreamEvent', { cellId, type: 'thinking', content: 'Starting sync...' });

      // Dynamic import of claude-agent-sdk (ESM module)
      console.log('[ai:syncStream] Importing Claude Agent SDK...');
      console.log('[ai:syncStream] PATH:', process.env.PATH);
      console.log('[ai:syncStream] CLAUDE_CODE_USE_BEDROCK:', process.env.CLAUDE_CODE_USE_BEDROCK);

      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      console.log('[ai:syncStream] Calling Claude Agent SDK query...');
      console.log('[ai:syncStream] Working directory:', process.cwd());
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
        console.log('[ai:syncStream] Received message type:', message.type);
        console.log('[ai:syncStream] Full message:', JSON.stringify(message, null, 2).slice(0, 500));

        // Handle streaming events (partial messages)
        if (message.type === 'stream_event' && 'event' in message) {
          const streamEvent = message as { type: 'stream_event'; event: { type: string; delta?: { type: string; text?: string; thinking?: string } } };
          const event = streamEvent.event;
          console.log('[ai:syncStream] Stream event type:', event.type);

          // Handle text delta events
          if (event.type === 'content_block_delta' && event.delta) {
            console.log('[ai:syncStream] Delta type:', event.delta.type);
            if (event.delta.type === 'text_delta' && event.delta.text) {
              console.log('[ai:syncStream] Sending text delta to renderer, length:', event.delta.text.length);
              webContents.send('ai:syncStreamEvent', { cellId, type: 'content', content: event.delta.text });
            }
            // Handle thinking delta events (extended thinking)
            if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
              console.log('[ai:syncStream] Sending thinking delta to renderer, length:', event.delta.thinking.length);
              webContents.send('ai:syncStreamEvent', { cellId, type: 'thinking', content: event.delta.thinking });
            }
          }
        }

        // Check for assistant messages with partial content
        if (message.type === 'assistant' && 'message' in message) {
          const assistantMsg = message as { type: 'assistant'; message: { content?: Array<{ type: string; text?: string }> } };
          console.log('[ai:syncStream] Assistant message content count:', assistantMsg.message.content?.length);
        }

        // Collect the final result
        if (message.type === 'result') {
          result = (message as { type: 'result'; result: string }).result;
          console.log('[ai:syncStream] Got result, length:', result.length);
        }
      }

      console.log('[ai:syncStream] Query complete, result length:', result.length);

      if (!result) {
        throw new Error('No result from Claude Agent SDK');
      }

      // Parse the response using the core library
      const alignedResults = parseOrchestratorResponse(result);
      console.log('[ai:syncStream] Parsed results successfully');

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

      console.log('[ai:syncStream] Returning success');
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[ai:syncStream] Error:', errorMessage);
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
