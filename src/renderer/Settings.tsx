import React, { useState, useEffect } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export type DefaultTab = 'short' | 'pseudo' | 'code';

export interface AppSettings {
  theme: ThemePreference;
  editor: {
    defaultTab: DefaultTab;
  };
  python: {
    selectedEnvironment?: string;
  };
  ai: {
    provider: 'agent' | 'claude' | 'bedrock' | 'openai' | 'ollama';
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
  spellcheck: {
    enabled: boolean;
    languages: string[];
  };
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  editor: {
    defaultTab: 'short',
  },
  python: {},
  ai: {
    provider: 'agent',
  },
  kernel: {
    startupTimeout: 30000,
  },
  spellcheck: {
    enabled: true,
    languages: ['en-US'],
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

  const updateSpellcheck = (updates: Partial<AppSettings['spellcheck']>) => {
    setLocalSettings((s) => ({ ...s, spellcheck: { ...s.spellcheck, ...updates } }));
  };

  const updateTheme = (theme: AppSettings['theme']) => {
    setLocalSettings((s) => ({ ...s, theme }));
  };

  const updateEditor = (updates: Partial<AppSettings['editor']>) => {
    setLocalSettings((s) => ({ ...s, editor: { ...s.editor, ...updates } }));
  };

  // Available languages for spell check
  const spellcheckLanguages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
  ];

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
          {/* Appearance Section */}
          <section className="settings-section">
            <h3>
              <span className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="9" cy="9" r="3" />
                  <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
                </svg>
              </span>
              Appearance
            </h3>
            <div className="settings-field">
              <label>Theme</label>
              <div className="settings-theme-grid">
                {(['system', 'light', 'dark'] as const).map((theme) => (
                  <button
                    key={theme}
                    className={`settings-theme-btn ${localSettings.theme === theme ? 'active' : ''}`}
                    onClick={() => updateTheme(theme)}
                  >
                    {theme === 'system' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="12" height="9" rx="1" />
                          <path d="M5 15h6M8 12v3" />
                        </svg>
                        <span>System</span>
                      </>
                    )}
                    {theme === 'light' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="8" cy="8" r="3" />
                          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                        </svg>
                        <span>Light</span>
                      </>
                    )}
                    {theme === 'dark' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4 4 0 0 0 6 6z" />
                        </svg>
                        <span>Dark</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <p className="settings-hint">
                System follows your OS appearance settings
              </p>
            </div>
          </section>

          {/* Editor Section */}
          <section className="settings-section">
            <h3>
              <span className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="14" height="14" rx="2" />
                  <path d="M2 6h14M6 6v10" />
                </svg>
              </span>
              Editor
            </h3>
            <div className="settings-field">
              <label>Default Tab</label>
              <div className="settings-theme-grid">
                {(['short', 'pseudo', 'code'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`settings-theme-btn ${localSettings.editor?.defaultTab === tab ? 'active' : ''}`}
                    onClick={() => updateEditor({ defaultTab: tab })}
                  >
                    {tab === 'short' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M2 8h8M2 12h6" />
                        </svg>
                        <span>Short</span>
                      </>
                    )}
                    {tab === 'pseudo' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M4 7h10M6 10h8M4 13h10" />
                        </svg>
                        <span>Pseudo</span>
                      </>
                    )}
                    {tab === 'code' && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" />
                        </svg>
                        <span>Code</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <p className="settings-hint">
                Tab shown by default when creating new cells
              </p>
            </div>
          </section>

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
                {(['agent', 'claude', 'bedrock', 'openai', 'ollama'] as const).map((provider) => (
                  <button
                    key={provider}
                    className={`settings-provider-btn ${localSettings.ai.provider === provider ? 'active' : ''}`}
                    onClick={() => updateAI({ provider })}
                  >
                    {provider === 'agent' && 'Claude Agent (Bedrock)'}
                    {provider === 'claude' && 'Claude API'}
                    {provider === 'bedrock' && 'AWS Bedrock'}
                    {provider === 'openai' && 'OpenAI'}
                    {provider === 'ollama' && 'Ollama'}
                  </button>
                ))}
              </div>
            </div>

            {/* Claude Agent Settings */}
            {localSettings.ai.provider === 'agent' && (
              <div className="settings-field">
                <p className="settings-hint" style={{ marginTop: 0 }}>
                  Uses the Claude Agent SDK via Bedrock. No API key required -
                  authentication is handled automatically via the <code>claude</code> CLI credentials
                  stored in <code>~/.claude</code>.
                </p>
                <p className="settings-hint">
                  If not logged in, run <code>claude login</code> in your terminal first.
                </p>
              </div>
            )}

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

          {/* Spell Check Section */}
          <section className="settings-section">
            <h3>
              <span className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 14h14M9 2v12M5 6l4-4 4 4" />
                </svg>
              </span>
              Spell Check
            </h3>
            <div className="settings-field">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={localSettings.spellcheck?.enabled ?? true}
                  onChange={(e) => updateSpellcheck({ enabled: e.target.checked })}
                />
                <span>Enable spell checking</span>
              </label>
              <p className="settings-hint">
                Underlines misspelled words and provides suggestions via right-click menu
              </p>
            </div>

            {localSettings.spellcheck?.enabled && (
              <div className="settings-field">
                <label>Languages</label>
                <div className="settings-language-grid">
                  {spellcheckLanguages.map((lang) => (
                    <label key={lang.code} className="settings-checkbox-label settings-checkbox-label--small">
                      <input
                        type="checkbox"
                        checked={localSettings.spellcheck?.languages?.includes(lang.code) ?? false}
                        onChange={(e) => {
                          const currentLangs = localSettings.spellcheck?.languages || [];
                          if (e.target.checked) {
                            updateSpellcheck({ languages: [...currentLangs, lang.code] });
                          } else {
                            updateSpellcheck({ languages: currentLangs.filter((l) => l !== lang.code) });
                          }
                        }}
                      />
                      <span>{lang.name}</span>
                    </label>
                  ))}
                </div>
              </div>
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
