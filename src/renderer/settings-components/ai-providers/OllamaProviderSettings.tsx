import React from 'react';

interface OllamaProviderSettingsProps {
  url: string;
  model: string;
  onUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
}

export function OllamaProviderSettings({
  url,
  model,
  onUrlChange,
  onModelChange,
}: OllamaProviderSettingsProps) {
  return (
    <>
      <div className="settings-field">
        <label>Ollama URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="http://localhost:11434"
        />
      </div>
      <div className="settings-field">
        <label>Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="llama3"
        />
        <p className="settings-hint">
          Make sure Ollama is running and the model is pulled
        </p>
      </div>
    </>
  );
}
