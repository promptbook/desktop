import React from 'react';
import type { AppSettings } from './types';

interface KernelSettingsProps {
  startupTimeout: AppSettings['kernel']['startupTimeout'];
  onStartupTimeoutChange: (timeout: number) => void;
}

export function KernelSettings({ startupTimeout, onStartupTimeoutChange }: KernelSettingsProps) {
  return (
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
          value={Math.round(startupTimeout / 1000)}
          onChange={(e) => onStartupTimeoutChange(parseInt(e.target.value, 10) * 1000)}
          min={5}
          max={120}
        />
        <p className="settings-hint">
          Maximum time to wait for the kernel to start (default: 30 seconds)
        </p>
      </div>
    </section>
  );
}
