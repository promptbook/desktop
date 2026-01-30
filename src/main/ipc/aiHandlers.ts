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
  error?: string;
}

/**
 * Parse structured JSON output from code generation
 * Falls back to extracting code from markdown if JSON parsing fails
 */
function parseCodeGenerationResult(response: string, isToCode: boolean): { code: string; symbols: GeneratedSymbol[] } {
  if (!isToCode) {
    return { code: response.trim(), symbols: [] };
  }

  // Try to parse as JSON first
  try {
    // Look for JSON object in the response
    const jsonMatch = response.match(/\{[\s\S]*"code"[\s\S]*"symbols"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as CodeGenerationResult;
      if (parsed.code && Array.isArray(parsed.symbols)) {
        return {
          code: parsed.code.trim(),
          symbols: parsed.symbols.filter(s =>
            s.name && s.kind && (s.kind === 'variable' || s.kind === 'function')
          ),
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

  return { code: code.trim(), symbols: [] };
}

async function aiSyncWithAgent(
  direction: string,
  context: AiSyncContext
): Promise<AiSyncResult> {
  try {
    const { query } = await dynamicImport('@anthropic-ai/claude-agent-sdk');

    const prompt = buildSyncPrompt(direction, context);

    let rawResult = '';

    // Use the Claude Agent SDK query function
    for await (const message of query({
      prompt,
      options: {
        tools: [],
        permissionMode: 'bypassPermissions',
        maxTurns: 1,
        persistSession: false,
        env: {
          ...process.env,
          CLAUDE_CODE_USE_BEDROCK: '1',
          AWS_REGION: process.env.AWS_REGION || 'us-east-1',
        },
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
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    const { code, symbols } = parseCodeGenerationResult(rawResult, isToCode);

    return { success: true, result: code, symbols };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Sync] Exception:', errorMessage);
    return { success: false, error: `Agent SDK Error: ${errorMessage}` };
  }
}

async function aiSyncWithClaude(
  direction: string,
  context: AiSyncContext
): Promise<AiSyncResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const prompt = buildSyncPrompt(direction, context);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (textBlock && textBlock.type === 'text') {
    const rawResult = textBlock.text;
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    const { code, symbols } = parseCodeGenerationResult(rawResult, isToCode);
    return { success: true, result: code, symbols };
  }

  return { success: false, error: 'No response generated' };
}

export function registerAiHandlers(getCurrentSettings: () => { ai?: AiSettings }): void {
  ipcMain.handle('ai:sync', async (_event, _cellId: string, direction: string, context: AiSyncContext) => {
    try {
      const provider = getCurrentSettings().ai?.provider || 'agent';

      switch (provider) {
        case 'agent':
          return await aiSyncWithAgent(direction, context);

        case 'claude':
          return await aiSyncWithClaude(direction, context);

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
