import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings, ThemePreference } from '../Settings';
import { Icons } from '../icons';

export interface UseThemeReturn {
  themeClass: string;
  handleThemeToggle: () => void;
  getThemeIcon: () => React.ReactNode;
  getThemeLabel: () => string;
}

/**
 * Hook to manage theme state and theme-related functions
 */
export function useTheme(
  settings: AppSettings,
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>
): UseThemeReturn {
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute effective theme class
  const themeClass = useMemo(() => {
    const theme = settings.theme || 'system';
    if (theme === 'system') {
      return systemPrefersDark ? 'theme-dark' : 'theme-light';
    }
    return `theme-${theme}`;
  }, [settings.theme, systemPrefersDark]);

  // Quick theme toggle (cycles: system -> light -> dark -> system)
  const handleThemeToggle = useCallback(() => {
    const currentTheme = settings.theme || 'system';
    const nextTheme: ThemePreference =
      currentTheme === 'system' ? 'light' :
      currentTheme === 'light' ? 'dark' : 'system';
    const newSettings = { ...settings, theme: nextTheme };
    setSettings(newSettings);
    window.promptbook.settings.save(newSettings);
  }, [settings, setSettings]);

  // Get theme icon for current state
  const getThemeIcon = useCallback(() => {
    const theme = settings.theme || 'system';
    if (theme === 'system') return Icons.system;
    if (theme === 'light') return Icons.sun;
    return Icons.moon;
  }, [settings.theme]);

  const getThemeLabel = useCallback(() => {
    const theme = settings.theme || 'system';
    if (theme === 'system') return 'System';
    if (theme === 'light') return 'Light';
    return 'Dark';
  }, [settings.theme]);

  return {
    themeClass,
    handleThemeToggle,
    getThemeIcon,
    getThemeLabel,
  };
}
