import { ipcMain } from 'electron';
import { buildSyncPrompt, type AiSyncContext, type GeneratedSymbol, type CodeGenerationResult } from '@promptbook/core/sync';

// Helper to import ESM modules in CommonJS context
const dynamicImport = new Function('specifier', 'return import(specifier)');

interface AiSettings {
  provider: 'agent' | 'claude' | 'bedrock' | 'openai' | 'ollama';
  claudeApiKey?: string;
  openaiApiKey?: string;
  bedrockRegion?: string;
  bedrockProfile?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

interface AiSyncResult {
  success: boolean;
  result?: string;
  symbols?: GeneratedSymbol[];
  /** All symbols from the entire notebook (all cells) */
  notebookSymbols?: GeneratedSymbol[];
  error?: string;
}

/**
 * Parse structured JSON output from code generation
 * Falls back to extracting code from markdown if JSON parsing fails
 */
function parseCodeGenerationResult(response: string, isToCode: boolean): { code: string; symbols: GeneratedSymbol[]; notebookSymbols: GeneratedSymbol[] } {
  if (!isToCode) {
    return { code: response.trim(), symbols: [], notebookSymbols: [] };
  }

  // Try to parse as JSON first
  try {
    // Look for JSON object in the response
    const jsonMatch = response.match(/\{[\s\S]*"code"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as CodeGenerationResult;
      if (parsed.code) {
        const filterSymbols = (arr: GeneratedSymbol[] | undefined) =>
          (arr || []).filter(s => s.name && s.kind && (s.kind === 'variable' || s.kind === 'function'));
        return {
          code: parsed.code.trim(),
          symbols: filterSymbols(parsed.symbols),
          notebookSymbols: filterSymbols(parsed.notebookSymbols),
        };
      }
    }
  } catch {
    // JSON parsing failed, continue to fallback
  }

  // Fallback: extract code from markdown code blocks
  let code = response;
  const codeMatch = response.match(/```(?:python)?\s*([\s\S]*?)```/);
  if (codeMatch) {
    code = codeMatch[1];
  }

  return { code: code.trim(), symbols: [], notebookSymbols: [] };
}

async function aiSyncWithAgent(
  direction: string,
  context: AiSyncContext,
  settings: AiSettings
): Promise<AiSyncResult> {
  try {
    const { query } = await dynamicImport('@anthropic-ai/claude-agent-sdk');

    const prompt = buildSyncPrompt(direction, context);

    let rawResult = '';

    // Build environment variables, respecting user settings
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
    };

    // Use Bedrock settings if configured
    if (settings.bedrockRegion) {
      env.CLAUDE_CODE_USE_BEDROCK = '1';
      env.AWS_REGION = settings.bedrockRegion;
    }
    if (settings.bedrockProfile) {
      env.AWS_PROFILE = settings.bedrockProfile;
    }

    // Use the Claude Agent SDK query function
    for await (const message of query({
      prompt,
      options: {
        tools: [],
        permissionMode: 'bypassPermissions',
        maxTurns: 1,
        persistSession: false,
        env,
      },
    })) {
      if (message.type === 'result') {
        rawResult = (message as { type: 'result'; result: string }).result;
      }
    }

    if (!rawResult) {
      return { success: false, error: 'No response generated' };
    }

    // Parse the result based on direction
    const isToCode = direction === 'toCode' || direction === 'pseudoToCode' || direction === 'shortToCode';
    const { code, symbols, notebookSymbols } = parseCodeGenerationResult(rawResult, isToCode);

    return { success: true, result: code, symbols, notebookSymbols };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Sync] Exception:', errorMessage);
    return { success: false, error: `Agent SDK Error: ${errorMessage}` };
  }
}

async function aiSyncWithClaude(
  direction: string,
  context: AiSyncContext,
  settings: AiSettings
): Promise<AiSyncResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  // Use API key from settings if provided, otherwise fall back to environment variable
  const clientOptions: { apiKey?: string } = {};
  if (settings.claudeApiKey) {
    clientOptions.apiKey = settings.claudeApiKey;
  }

  const client = new Anthropic(clientOptions);

  const prompt = buildSyncPrompt(direction, context);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (textBlock && textBlock.type === 'text') {
    const rawResult = textBlock.text;
    const isToCode = direction === 'toCode' || direction === 'pseudoToCode' || direction === 'shortToCode';
    const { code, symbols, notebookSymbols } = parseCodeGenerationResult(rawResult, isToCode);
    return { success: true, result: code, symbols, notebookSymbols };
  }

  return { success: false, error: 'No response generated' };
}

export function registerAiHandlers(getCurrentSettings: () => { ai?: AiSettings }): void {
  ipcMain.handle('ai:sync', async (_event, _cellId: string, direction: string, context: AiSyncContext) => {
    try {
      const aiSettings = getCurrentSettings().ai || { provider: 'agent' };
      const provider = aiSettings.provider || 'agent';

      switch (provider) {
        case 'agent':
          return await aiSyncWithAgent(direction, context, aiSettings);

        case 'claude':
          return await aiSyncWithClaude(direction, context, aiSettings);

        case 'bedrock':
          return { success: false, error: 'Bedrock provider not yet implemented' };

        case 'openai':
          return { success: false, error: 'OpenAI provider not yet implemented' };

        case 'ollama':
          return { success: false, error: 'Ollama provider not yet implemented' };

        default:
          return { success: false, error: `Unknown provider: ${provider}` };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `AI Error: ${errorMessage}` };
    }
  });
}
