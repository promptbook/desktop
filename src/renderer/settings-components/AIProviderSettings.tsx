import React from 'react';
import type { AppSettings } from './types';
import {
  AgentProviderSettings,
  ClaudeProviderSettings,
  BedrockProviderSettings,
  OpenAIProviderSettings,
  OllamaProviderSettings,
} from './ai-providers';

interface AIProviderSettingsProps {
  ai: AppSettings['ai'];
  onAIChange: (updates: Partial<AppSettings['ai']>) => void;
}

const PROVIDERS = [
  { id: 'agent', label: 'Claude Agent (Bedrock)' },
  { id: 'claude', label: 'Claude API' },
  { id: 'bedrock', label: 'AWS Bedrock' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'ollama', label: 'Ollama' },
] as const;

export function AIProviderSettings({ ai, onAIChange }: AIProviderSettingsProps) {
  return (
    <section className="settings-section">
      <h3>
        <span className="settings-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 1.5l1.5 4.5L15 7.5l-4.5 1.5L9 13.5 7.5 9 3 7.5l4.5-1.5L9 1.5z" />
            <path d="M14 12l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L12 14l1.5-.5.5-1.5z" />
          </svg>
        </span>
        AI Provider
      </h3>
      <div className="settings-field">
        <label>Provider</label>
        <div className="settings-provider-grid">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              className={`settings-provider-btn ${ai.provider === provider.id ? 'active' : ''}`}
              onClick={() => onAIChange({ provider: provider.id })}
            >
              {provider.label}
            </button>
          ))}
        </div>
      </div>

      {ai.provider === 'agent' && <AgentProviderSettings />}

      {ai.provider === 'claude' && (
        <ClaudeProviderSettings
          apiKey={ai.claudeApiKey || ''}
          onApiKeyChange={(value) => onAIChange({ claudeApiKey: value })}
        />
      )}

      {ai.provider === 'bedrock' && (
        <BedrockProviderSettings
          region={ai.bedrockRegion || ''}
          profile={ai.bedrockProfile || ''}
          onRegionChange={(value) => onAIChange({ bedrockRegion: value })}
          onProfileChange={(value) => onAIChange({ bedrockProfile: value })}
        />
      )}

      {ai.provider === 'openai' && (
        <OpenAIProviderSettings
          apiKey={ai.openaiApiKey || ''}
          onApiKeyChange={(value) => onAIChange({ openaiApiKey: value })}
        />
      )}

      {ai.provider === 'ollama' && (
        <OllamaProviderSettings
          url={ai.ollamaUrl || ''}
          model={ai.ollamaModel || ''}
          onUrlChange={(value) => onAIChange({ ollamaUrl: value })}
          onModelChange={(value) => onAIChange({ ollamaModel: value })}
        />
      )}
    </section>
  );
}
