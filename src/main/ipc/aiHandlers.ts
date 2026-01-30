import { ipcMain } from 'electron';
import { buildSyncPrompt, type AiSyncContext } from '@promptbook/core/sync';

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

async function aiSyncWithAgent(
  direction: string,
  context: AiSyncContext
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const { query } = await dynamicImport('@anthropic-ai/claude-agent-sdk');

    const prompt = buildSyncPrompt(direction, context);

    let result = '';

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
        result = (message as { type: 'result'; result: string }).result;
      }
    }

    if (!result) {
      return { success: false, error: 'No response generated' };
    }

    // Clean up markdown code blocks
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    if (isToCode) {
      const codeMatch = result.match(/```(?:python)?\s*([\s\S]*?)```/);
      if (codeMatch) {
        result = codeMatch[1];
      }
    }

    return { success: true, result: result.trim() };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Sync] Exception:', errorMessage);
    return { success: false, error: `Agent SDK Error: ${errorMessage}` };
  }
}

async function aiSyncWithClaude(
  direction: string,
  context: AiSyncContext
): Promise<{ success: boolean; result?: string; error?: string }> {
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
    let result = textBlock.text;
    const isToCode = direction === 'toCode' || direction === 'fullToCode' || direction === 'shortToCode';
    if (isToCode) {
      result = result.replace(/^```python\n?/i, '').replace(/\n?```$/i, '');
      result = result.replace(/^```\n?/, '').replace(/\n?```$/i, '');
    }
    return { success: true, result: result.trim() };
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
