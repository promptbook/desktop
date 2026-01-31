import React from 'react';

interface ClaudeProviderSettingsProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}

export function ClaudeProviderSettings({ apiKey, onApiKeyChange }: ClaudeProviderSettingsProps) {
  return (
    <div className="settings-field">
      <label>API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder="sk-ant-..."
      />
      <p className="settings-hint">
        Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>
      </p>
    </div>
  );
}
