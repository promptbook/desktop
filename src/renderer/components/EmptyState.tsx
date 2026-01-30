import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  onOpenSidebar?: () => void;
}

export function EmptyState({ onOpenSidebar }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__content">
        <div className="empty-state__art">
          <pre>{`
     ____                            __  __                __
    / __ \\_________  ____ ___  ____  / /_/ /_  ____  ____  / /__
   / /_/ / ___/ __ \\/ __ \`__ \\/ __ \\/ __/ __ \\/ __ \\/ __ \\/ //_/
  / ____/ /  / /_/ / / / / / / /_/ / /_/ /_/ / /_/ / /_/ / ,<
 /_/   /_/   \\____/_/ /_/ /_/ .___/\\__/_.___/\\____/\\____/_/|_|
                          /_/
          `}</pre>
        </div>

        <h2>Ready to create?</h2>

        <div className="empty-state__features">
          <div className="empty-state__feature">
            <div className="empty-state__feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3 7h7l-6 4 2 7-6-5-6 5 2-7-6-4h7l3-7z" />
              </svg>
            </div>
            <p><strong>AI-Powered</strong> — Describe what you want, get Python code</p>
          </div>

          <div className="empty-state__feature">
            <div className="empty-state__feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 9l3 3-3 3M13 15h3" />
                <rect x="3" y="4" width="18" height="16" rx="2" />
              </svg>
            </div>
            <p><strong>Execute</strong> — Run code cells with persistent state</p>
          </div>

          <div className="empty-state__feature">
            <div className="empty-state__feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 12h16M4 6h16M4 18h16" />
              </svg>
            </div>
            <p><strong>Parameters</strong> — Create reusable, configurable notebooks</p>
          </div>

          <div className="empty-state__feature">
            <div className="empty-state__feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p><strong>Bidirectional Sync</strong> — Keep descriptions and code in sync</p>
          </div>
        </div>

        <p className="empty-state__hint">
          Hover over the left edge to open the file browser, or use the + button to create a new notebook.
        </p>

        <div className="empty-state__shortcuts">
          <span><kbd>⌘</kbd>+<kbd>N</kbd> New notebook</span>
          <span><kbd>⌘</kbd>+<kbd>B</kbd> Toggle sidebar</span>
          <span><kbd>⌘</kbd>+<kbd>Enter</kbd> Run cell</span>
        </div>
      </div>
    </div>
  );
}
