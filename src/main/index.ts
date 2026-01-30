import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

// Electron plugins
import log from 'electron-log/main';
import Store from 'electron-store';
import windowStateKeeper from 'electron-window-state';
import contextMenu from 'electron-context-menu';

// IPC handlers
import { registerProjectHandlers } from './ipc/projectHandlers';
import { registerSessionHandlers } from './ipc/sessionHandlers';
import {
  registerKernelHandlers,
  scanEnvironments,
  getCachedEnvironments,
  shutdownKernel,
  startKernelWithEnvironment,
} from './ipc/kernelHandlers';
import { registerAiHandlers } from './ipc/aiHandlers';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerVersionHandlers } from './ipc/versionHandlers';
import { registerUtilityHandlers } from './ipc/utilityHandlers';

// ============================================
// Logging Setup
// ============================================
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Replace console with electron-log
Object.assign(console, log.functions);

log.info('Promptbook starting...');

// ============================================
// Settings with electron-store
// ============================================
interface AppSettings {
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

const defaultSettings: AppSettings = {
  python: {},
  ai: { provider: 'agent' },
  kernel: { startupTimeout: 30000 },
  spellcheck: { enabled: true, languages: ['en-US'] },
};

// Persistent store with electron-store
const store = new Store<AppSettings>({
  defaults: defaultSettings,
  name: 'promptbook-settings',
});

// Get current settings
function getSettings(): AppSettings {
  return {
    python: store.get('python', defaultSettings.python),
    ai: store.get('ai', defaultSettings.ai),
    kernel: store.get('kernel', defaultSettings.kernel),
    spellcheck: store.get('spellcheck', defaultSettings.spellcheck),
  };
}

// Save settings
function saveSettings(settings: AppSettings): void {
  store.set('python', settings.python);
  store.set('ai', settings.ai);
  store.set('kernel', settings.kernel);
  store.set('spellcheck', settings.spellcheck);
  log.info('Settings saved');
}

// Current settings (cached)
let currentSettings = getSettings();

let mainWindow: BrowserWindow | null = null;
let mainWindowState: ReturnType<typeof windowStateKeeper> | null = null;

// ============================================
// Context Menu Setup
// ============================================
function setupContextMenu() {
  contextMenu({
    showSaveImageAs: true,
    showCopyImage: true,
    showCopyImageAddress: true,
    showInspectElement: process.env.NODE_ENV === 'development',
    showSearchWithGoogle: false,
    prepend: (_defaultActions, parameters, browserWindow) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = [];

      // Get webContents safely
      const getWebContents = () => {
        if (!browserWindow) return null;
        if ('webContents' in browserWindow) {
          return (browserWindow as BrowserWindow).webContents;
        }
        return null;
      };

      // Spell check suggestions
      if (parameters.misspelledWord) {
        menuItems.push({
          label: `Add "${parameters.misspelledWord}" to dictionary`,
          click: () => {
            const webContents = getWebContents();
            webContents?.session.addWordToSpellCheckerDictionary(parameters.misspelledWord);
          },
        });
        menuItems.push({ type: 'separator' });

        // Add suggestions
        if (parameters.dictionarySuggestions.length > 0) {
          parameters.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
            menuItems.push({
              label: suggestion,
              click: () => {
                const webContents = getWebContents();
                webContents?.replaceMisspelling(suggestion);
              },
            });
          });
          menuItems.push({ type: 'separator' });
        }
      }

      return menuItems;
    },
    labels: {
      copy: 'Copy',
      paste: 'Paste',
      cut: 'Cut',
      selectAll: 'Select All',
      copyLink: 'Copy Link',
      copyImage: 'Copy Image',
      saveImageAs: 'Save Image As...',
      inspect: 'Inspect Element',
    },
  });

  log.info('Context menu initialized');
}

// ============================================
// Spell Checker Setup
// ============================================
function setupSpellChecker() {
  const ses = session.defaultSession;
  const spellcheckSettings = currentSettings.spellcheck;

  if (spellcheckSettings.enabled) {
    ses.setSpellCheckerLanguages(spellcheckSettings.languages);
    log.info('Spell checker enabled with languages:', spellcheckSettings.languages);
  }
}

// ============================================
// Window Creation
// ============================================
function createWindow() {
  // Remember window size and position
  mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: currentSettings.spellcheck.enabled,
    },
  });

  // Track window state
  mainWindowState.manage(mainWindow);

  // Set up spell checker
  setupSpellChecker();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

// ============================================
// App Lifecycle
// ============================================
app.whenReady().then(async () => {
  log.info('App ready');

  // Load settings from store
  currentSettings = getSettings();

  // Set up context menu globally
  setupContextMenu();

  // Create main window
  createWindow();

  // Register all IPC handlers
  registerProjectHandlers();
  registerSessionHandlers();
  registerKernelHandlers(
    () => mainWindow,
    saveSettings,
    () => currentSettings
  );
  registerAiHandlers(() => currentSettings);
  registerFileHandlers(() => mainWindow);
  registerVersionHandlers();
  registerUtilityHandlers(
    () => currentSettings,
    (settings) => { currentSettings = settings; },
    saveSettings
  );

  // Scan for environments in background
  scanEnvironments().catch((err) => log.error('Failed to scan environments:', err));

  // If we have a previously selected environment, try to start the kernel
  if (currentSettings.python.selectedEnvironment) {
    const cachedEnvironments = getCachedEnvironments();
    const env = cachedEnvironments.find(
      (e) => e.path === currentSettings.python.selectedEnvironment
    );
    if (env) {
      await startKernelWithEnvironment(currentSettings.python.selectedEnvironment, mainWindow);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  await shutdownKernel();
});
