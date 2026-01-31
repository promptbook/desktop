import { ipcMain, session, clipboard } from 'electron';
import log from 'electron-log/main';

interface AppSettings {
  editor: { defaultTab: 'short' | 'pseudo' | 'code' };
  python: { selectedEnvironment?: string };
  ai: {
    provider: 'agent' | 'claude' | 'bedrock' | 'openai' | 'ollama';
    claudeApiKey?: string;
    openaiApiKey?: string;
    bedrockRegion?: string;
    bedrockProfile?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };
  kernel: { startupTimeout: number };
  spellcheck: { enabled: boolean; languages: string[] };
}

export function registerUtilityHandlers(
  getCurrentSettings: () => AppSettings,
  setCurrentSettings: (settings: AppSettings) => void,
  saveSettings: (settings: AppSettings) => void
): void {
  // Settings handlers
  ipcMain.handle('settings:load', async () => {
    return getCurrentSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    setCurrentSettings(settings);
    saveSettings(settings);

    // Update spell checker if settings changed
    const ses = session.defaultSession;
    if (settings.spellcheck?.enabled) {
      ses.setSpellCheckerLanguages(settings.spellcheck.languages);
    }

    return { success: true };
  });

  // Clipboard handlers
  ipcMain.handle('clipboard:read', () => {
    return clipboard.readText();
  });

  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('clipboard:readHTML', () => {
    return clipboard.readHTML();
  });

  ipcMain.handle('clipboard:writeHTML', (_event, html: string) => {
    clipboard.writeHTML(html);
    return { success: true };
  });

  // Spell checker handlers
  ipcMain.handle('spellcheck:getLanguages', () => {
    return session.defaultSession.getSpellCheckerLanguages();
  });

  ipcMain.handle('spellcheck:setLanguages', (_event, languages: string[]) => {
    session.defaultSession.setSpellCheckerLanguages(languages);
    const currentSettings = getCurrentSettings();
    currentSettings.spellcheck.languages = languages;
    saveSettings(currentSettings);
    return { success: true };
  });

  ipcMain.handle('spellcheck:addWord', (_event, word: string) => {
    session.defaultSession.addWordToSpellCheckerDictionary(word);
    log.info('Added word to dictionary:', word);
    return { success: true };
  });
}
