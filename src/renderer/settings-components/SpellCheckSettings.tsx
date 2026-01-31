import React from 'react';
import type { AppSettings } from './types';

interface SpellCheckSettingsProps {
  spellcheck: AppSettings['spellcheck'];
  onSpellcheckChange: (updates: Partial<AppSettings['spellcheck']>) => void;
}

const SPELLCHECK_LANGUAGES = [
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

export function SpellCheckSettings({ spellcheck, onSpellcheckChange }: SpellCheckSettingsProps) {
  return (
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
            checked={spellcheck?.enabled ?? true}
            onChange={(e) => onSpellcheckChange({ enabled: e.target.checked })}
          />
          <span>Enable spell checking</span>
        </label>
        <p className="settings-hint">
          Underlines misspelled words and provides suggestions via right-click menu
        </p>
      </div>

      {spellcheck?.enabled && (
        <div className="settings-field">
          <label>Languages</label>
          <div className="settings-language-grid">
            {SPELLCHECK_LANGUAGES.map((lang) => (
              <label key={lang.code} className="settings-checkbox-label settings-checkbox-label--small">
                <input
                  type="checkbox"
                  checked={spellcheck?.languages?.includes(lang.code) ?? false}
                  onChange={(e) => {
                    const currentLangs = spellcheck?.languages || [];
                    if (e.target.checked) {
                      onSpellcheckChange({ languages: [...currentLangs, lang.code] });
                    } else {
                      onSpellcheckChange({ languages: currentLangs.filter((l) => l !== lang.code) });
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
  );
}
