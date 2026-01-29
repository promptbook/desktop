import React, { useState, useEffect } from 'react';

export interface AppSettings {
  python: {
    selectedEnvironment?: string;
  };
  ai: {
    provider: 'claude' | 'bedrock' | 'openai' | 'ollama';
    claudeApiKey?: string;
    openaiApiKey?: string;
    bedrockRegion?: string;
    bedrockProfile?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };
  kernel: {
    startupTimeout: number;
  };
}

export const defaultSettings: AppSettings = {
  python: {},
  ai: {
    provider: 'claude',
  },
  kernel: {
    startupTimeout: 30000,
  },
};

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export function Settings({ isOpen, onClose, settings, onSave }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const updateAI = (updates: Partial<AppSettings['ai']>) => {
    setLocalSettings((s) => ({ ...s, ai: { ...s.ai, ...updates } }));
  };

  const updateKernel = (updates: Partial<AppSettings['kernel']>) => {
    setLocalSettings((s) => ({ ...s, kernel: { ...s.kernel, ...updates } }));
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        <div className="settings-content">
          {/* Kernel Settings Section */}
          <section className="settings-section">
            <h3>
              <span className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M9 0C4.5 0 4.95 2.1 4.95 2.1l.005 2.175H9.18v.65H3.12S0 4.5 0 9s2.72 4.35 2.72 4.35h1.62v-2.1s-.09-2.72 2.68-2.72h4.6s2.59.04 2.59-2.5V2.6S14.55 0 9 0zM6.53 1.5a.84.84 0 110 1.68.84.84 0 010-1.68z"/>
                  <path d="M9 18c4.5 0 4.05-2.1 4.05-2.1l-.005-2.175H8.82v-.65h6.06S18 13.5 18 9s-2.72-4.35-2.72-4.35h-1.62v2.1s.09 2.72-2.68 2.72h-4.6s-2.59-.04-2.59 2.5v3.43S3.45 18 9 18zm2.47-1.5a.84.84 0 110-1.68.84.84 0 010 1.68z"/>
                </svg>
              </span>
              Python Kernel
            </h3>
            <p className="settings-hint" style={{ marginTop: 0 }}>
              Use the kernel status indicator in the header to select a Python environment.
              The app will automatically detect virtual environments, conda, pyenv, and system Python installations.
            </p>
            <div className="settings-field">
              <label>Startup Timeout (seconds)</label>
              <input
                type="number"
                value={Math.round(localSettings.kernel.startupTimeout / 1000)}
                onChange={(e) => updateKernel({ startupTimeout: parseInt(e.target.value, 10) * 1000 })}
                min={5}
                max={120}
              />
              <p className="settings-hint">
                Maximum time to wait for the kernel to start (default: 30 seconds)
              </p>
            </div>
          </section>

          {/* AI Provider Section */}
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
                {(['claude', 'bedrock', 'openai', 'ollama'] as const).map((provider) => (
                  <button
                    key={provider}
                    className={`settings-provider-btn ${localSettings.ai.provider === provider ? 'active' : ''}`}
                    onClick={() => updateAI({ provider })}
                  >
                    {provider === 'claude' && 'Claude API'}
                    {provider === 'bedrock' && 'AWS Bedrock'}
                    {provider === 'openai' && 'OpenAI'}
                    {provider === 'ollama' && 'Ollama'}
                  </button>
                ))}
              </div>
            </div>

            {/* Claude API Settings */}
            {localSettings.ai.provider === 'claude' && (
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={localSettings.ai.claudeApiKey || ''}
                  onChange={(e) => updateAI({ claudeApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                />
                <p className="settings-hint">
                  Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>
                </p>
              </div>
            )}

            {/* Bedrock Settings */}
            {localSettings.ai.provider === 'bedrock' && (
              <>
                <div className="settings-field">
                  <label>AWS Region</label>
                  <input
                    type="text"
                    value={localSettings.ai.bedrockRegion || ''}
                    onChange={(e) => updateAI({ bedrockRegion: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                <div className="settings-field">
                  <label>AWS Profile (optional)</label>
                  <input
                    type="text"
                    value={localSettings.ai.bedrockProfile || ''}
                    onChange={(e) => updateAI({ bedrockProfile: e.target.value })}
                    placeholder="default"
                  />
                  <p className="settings-hint">
                    Uses AWS credentials from your environment or ~/.aws/credentials
                  </p>
                </div>
              </>
            )}

            {/* OpenAI Settings */}
            {localSettings.ai.provider === 'openai' && (
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={localSettings.ai.openaiApiKey || ''}
                  onChange={(e) => updateAI({ openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <p className="settings-hint">
                  Get your API key from <a href="https://platform.openai.com" target="_blank" rel="noopener">platform.openai.com</a>
                </p>
              </div>
            )}

            {/* Ollama Settings */}
            {localSettings.ai.provider === 'ollama' && (
              <>
                <div className="settings-field">
                  <label>Ollama URL</label>
                  <input
                    type="text"
                    value={localSettings.ai.ollamaUrl || ''}
                    onChange={(e) => updateAI({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="settings-field">
                  <label>Model</label>
                  <input
                    type="text"
                    value={localSettings.ai.ollamaModel || ''}
                    onChange={(e) => updateAI({ ollamaModel: e.target.value })}
                    placeholder="llama3"
                  />
                  <p className="settings-hint">
                    Make sure Ollama is running and the model is pulled
                  </p>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-save-btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
