import React from 'react';

export function AgentProviderSettings() {
  return (
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
  );
}
