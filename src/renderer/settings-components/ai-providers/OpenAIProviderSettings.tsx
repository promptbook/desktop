import React from 'react';

interface OpenAIProviderSettingsProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}

export function OpenAIProviderSettings({ apiKey, onApiKeyChange }: OpenAIProviderSettingsProps) {
  return (
    <div className="settings-field">
      <label>API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder="sk-..."
      />
      <p className="settings-hint">
        Get your API key from <a href="https://platform.openai.com" target="_blank" rel="noopener">platform.openai.com</a>
      </p>
    </div>
  );
}
