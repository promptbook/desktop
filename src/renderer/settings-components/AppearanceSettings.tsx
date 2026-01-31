import React from 'react';
import type { AppSettings } from './types';

interface AppearanceSettingsProps {
  theme: AppSettings['theme'];
  onThemeChange: (theme: AppSettings['theme']) => void;
}

export function AppearanceSettings({ theme, onThemeChange }: AppearanceSettingsProps) {
  return (
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
          {(['system', 'light', 'dark'] as const).map((themeOption) => (
            <button
              key={themeOption}
              className={`settings-theme-btn ${theme === themeOption ? 'active' : ''}`}
              onClick={() => onThemeChange(themeOption)}
            >
              {themeOption === 'system' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="12" height="9" rx="1" />
                    <path d="M5 15h6M8 12v3" />
                  </svg>
                  <span>System</span>
                </>
              )}
              {themeOption === 'light' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="3" />
                    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                  </svg>
                  <span>Light</span>
                </>
              )}
              {themeOption === 'dark' && (
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
  );
}
