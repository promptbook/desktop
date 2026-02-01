import React from 'react';
import type { AppSettings } from './types';

interface EditorSettingsProps {
  defaultTab: AppSettings['editor']['defaultTab'];
  onDefaultTabChange: (tab: AppSettings['editor']['defaultTab']) => void;
}

export function EditorSettings({ defaultTab, onDefaultTabChange }: EditorSettingsProps) {
  return (
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
              className={`settings-theme-btn ${defaultTab === tab ? 'active' : ''}`}
              onClick={() => onDefaultTabChange(tab)}
            >
              {tab === 'short' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4h12M2 8h8M2 12h6" />
                  </svg>
                  <span>Instructions</span>
                </>
              )}
              {tab === 'pseudo' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4h12M4 7h10M6 10h8M4 13h10" />
                  </svg>
                  <span>Detailed</span>
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
  );
}
