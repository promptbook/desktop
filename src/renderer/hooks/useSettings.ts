import { useState, useCallback, useEffect } from 'react';
import { AppSettings, defaultSettings } from '../Settings';

export interface UseSettingsReturn {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSettings: (newSettings: AppSettings) => Promise<void>;
}

/**
 * Hook to manage application settings state and persistence
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load settings on mount
  useEffect(() => {
    window.promptbook.settings.load().then(setSettings);
  }, []);

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    await window.promptbook.settings.save(newSettings);
    setSettings(newSettings);
  }, []);

  return {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    handleSaveSettings,
  };
}
