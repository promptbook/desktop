export type ThemePreference = 'system' | 'light' | 'dark';

export type DefaultTab = 'short' | 'pseudo' | 'code';

export interface AppSettings {
  theme: ThemePreference;
  editor: {
    defaultTab: DefaultTab;
  };
  python: {
    selectedEnvironment?: string;
  };
  ai: {
    provider: 'agent' | 'claude' | 'bedrock' | 'openai' | 'ollama';
    claudeApiKey?: string;
    openaiApiKey?: string;
    bedrockRegion?: string;
    bedrockProfile?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };
  kernel: {
    startupTimeout: number;
  };
  spellcheck: {
    enabled: boolean;
    languages: string[];
  };
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  editor: {
    defaultTab: 'short',
  },
  python: {},
  ai: {
    provider: 'agent',
  },
  kernel: {
    startupTimeout: 30000,
  },
  spellcheck: {
    enabled: true,
    languages: ['en-US'],
  },
};
