import React from 'react';

interface BedrockProviderSettingsProps {
  region: string;
  profile: string;
  onRegionChange: (value: string) => void;
  onProfileChange: (value: string) => void;
}

export function BedrockProviderSettings({
  region,
  profile,
  onRegionChange,
  onProfileChange,
}: BedrockProviderSettingsProps) {
  return (
    <>
      <div className="settings-field">
        <label>AWS Region</label>
        <input
          type="text"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          placeholder="us-east-1"
        />
      </div>
      <div className="settings-field">
        <label>AWS Profile (optional)</label>
        <input
          type="text"
          value={profile}
          onChange={(e) => onProfileChange(e.target.value)}
          placeholder="default"
        />
        <p className="settings-hint">
          Uses AWS credentials from your environment or ~/.aws/credentials
        </p>
      </div>
    </>
  );
}
