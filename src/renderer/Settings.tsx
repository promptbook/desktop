import React, { useState, useEffect } from 'react';
import {
  AppearanceSettings,
  EditorSettings,
  KernelSettings,
  AIProviderSettings,
  SpellCheckSettings,
} from './settings-components';
import type { AppSettings } from './settings-components/types';
import { defaultSettings } from './settings-components/types';

// Re-export types for backward compatibility
export type { ThemePreference, DefaultTab, AppSettings } from './settings-components/types';
export { defaultSettings } from './settings-components/types';

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

  const updateTheme = (theme: AppSettings['theme']) => {
    setLocalSettings((s) => ({ ...s, theme }));
  };

  const updateEditor = (updates: Partial<AppSettings['editor']>) => {
    setLocalSettings((s) => ({ ...s, editor: { ...s.editor, ...updates } }));
  };

  const updateKernel = (updates: Partial<AppSettings['kernel']>) => {
    setLocalSettings((s) => ({ ...s, kernel: { ...s.kernel, ...updates } }));
  };

  const updateAI = (updates: Partial<AppSettings['ai']>) => {
    setLocalSettings((s) => ({ ...s, ai: { ...s.ai, ...updates } }));
  };

  const updateSpellcheck = (updates: Partial<AppSettings['spellcheck']>) => {
    setLocalSettings((s) => ({ ...s, spellcheck: { ...s.spellcheck, ...updates } }));
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
          <AppearanceSettings
            theme={localSettings.theme}
            onThemeChange={updateTheme}
          />

          <EditorSettings
            defaultTab={localSettings.editor?.defaultTab ?? defaultSettings.editor.defaultTab}
            onDefaultTabChange={(tab) => updateEditor({ defaultTab: tab })}
          />

          <KernelSettings
            startupTimeout={localSettings.kernel.startupTimeout}
            onStartupTimeoutChange={(timeout) => updateKernel({ startupTimeout: timeout })}
          />

          <AIProviderSettings
            ai={localSettings.ai}
            onAIChange={updateAI}
          />

          <SpellCheckSettings
            spellcheck={localSettings.spellcheck}
            onSpellcheckChange={updateSpellcheck}
          />
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
