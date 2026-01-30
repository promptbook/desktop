import Store from 'electron-store';

export interface TabState {
  id: string;
  filePath: string; // Relative path within project
  scrollPosition: number;
  activeCellId: string | null;
}

export interface SidebarState {
  isVisible: boolean;
  isPinned: boolean;
  width: number;
}

export interface SessionState {
  projectId: string;
  openTabs: TabState[];
  activeTabId: string | null;
  sidebar: SidebarState;
}

const DEFAULT_SIDEBAR_STATE: SidebarState = {
  isVisible: false,
  isPinned: false,
  width: 280,
};

class SessionService {
  private store: Store<{ sessions: Record<string, SessionState> }>;

  constructor() {
    this.store = new Store({
      name: 'promptbook-sessions',
      defaults: {
        sessions: {},
      },
    });
  }

  // Get session for a project
  getSession(projectId: string): SessionState | null {
    const sessions = this.store.get('sessions', {});
    return sessions[projectId] || null;
  }

  // Create default session for a project
  createDefaultSession(projectId: string): SessionState {
    return {
      projectId,
      openTabs: [],
      activeTabId: null,
      sidebar: { ...DEFAULT_SIDEBAR_STATE },
    };
  }

  // Load session (creates default if doesn't exist)
  loadSession(projectId: string): SessionState {
    const existing = this.getSession(projectId);
    if (existing) return existing;

    const defaultSession = this.createDefaultSession(projectId);
    this.saveSession(defaultSession);
    return defaultSession;
  }

  // Save entire session
  saveSession(session: SessionState): void {
    const sessions = this.store.get('sessions', {});
    sessions[session.projectId] = session;
    this.store.set('sessions', sessions);
  }

  // Update specific parts of session
  updateSession(projectId: string, updates: Partial<Omit<SessionState, 'projectId'>>): SessionState {
    const session = this.loadSession(projectId);
    const updated = { ...session, ...updates };
    this.saveSession(updated);
    return updated;
  }

  // Tab operations
  addTab(projectId: string, tab: TabState): SessionState {
    const session = this.loadSession(projectId);

    // Check if tab already exists
    const existingIndex = session.openTabs.findIndex(t => t.filePath === tab.filePath);
    if (existingIndex >= 0) {
      // Tab exists, just make it active
      session.activeTabId = session.openTabs[existingIndex].id;
    } else {
      session.openTabs.push(tab);
      session.activeTabId = tab.id;
    }

    this.saveSession(session);
    return session;
  }

  removeTab(projectId: string, tabId: string): SessionState {
    const session = this.loadSession(projectId);

    const index = session.openTabs.findIndex(t => t.id === tabId);
    if (index >= 0) {
      session.openTabs.splice(index, 1);

      // Update active tab if needed
      if (session.activeTabId === tabId) {
        // Select adjacent tab
        if (session.openTabs.length > 0) {
          const newIndex = Math.min(index, session.openTabs.length - 1);
          session.activeTabId = session.openTabs[newIndex].id;
        } else {
          session.activeTabId = null;
        }
      }
    }

    this.saveSession(session);
    return session;
  }

  setActiveTab(projectId: string, tabId: string): SessionState {
    const session = this.loadSession(projectId);
    session.activeTabId = tabId;
    this.saveSession(session);
    return session;
  }

  updateTab(projectId: string, tabId: string, updates: Partial<Omit<TabState, 'id'>>): SessionState {
    const session = this.loadSession(projectId);

    const tab = session.openTabs.find(t => t.id === tabId);
    if (tab) {
      Object.assign(tab, updates);
      this.saveSession(session);
    }

    return session;
  }

  reorderTabs(projectId: string, fromIndex: number, toIndex: number): SessionState {
    const session = this.loadSession(projectId);

    if (fromIndex >= 0 && fromIndex < session.openTabs.length &&
        toIndex >= 0 && toIndex < session.openTabs.length) {
      const [moved] = session.openTabs.splice(fromIndex, 1);
      session.openTabs.splice(toIndex, 0, moved);
      this.saveSession(session);
    }

    return session;
  }

  // Sidebar operations
  updateSidebar(projectId: string, updates: Partial<SidebarState>): SessionState {
    const session = this.loadSession(projectId);
    session.sidebar = { ...session.sidebar, ...updates };
    this.saveSession(session);
    return session;
  }

  toggleSidebar(projectId: string): SessionState {
    const session = this.loadSession(projectId);
    session.sidebar.isVisible = !session.sidebar.isVisible;
    this.saveSession(session);
    return session;
  }

  pinSidebar(projectId: string, pinned: boolean): SessionState {
    const session = this.loadSession(projectId);
    session.sidebar.isPinned = pinned;
    session.sidebar.isVisible = pinned;
    this.saveSession(session);
    return session;
  }

  resizeSidebar(projectId: string, width: number): SessionState {
    const session = this.loadSession(projectId);
    session.sidebar.width = Math.max(200, Math.min(500, width));
    this.saveSession(session);
    return session;
  }

  // Clear session (when project is deleted or reset)
  clearSession(projectId: string): void {
    const sessions = this.store.get('sessions', {});
    delete sessions[projectId];
    this.store.set('sessions', sessions);
  }

  // Remove tabs for deleted files
  cleanupDeletedFiles(projectId: string, existingFiles: string[]): SessionState {
    const session = this.loadSession(projectId);
    const existingSet = new Set(existingFiles);

    session.openTabs = session.openTabs.filter(tab => existingSet.has(tab.filePath));

    // Fix active tab if it was removed
    if (session.activeTabId && !session.openTabs.find(t => t.id === session.activeTabId)) {
      session.activeTabId = session.openTabs[0]?.id || null;
    }

    this.saveSession(session);
    return session;
  }
}

// Export singleton instance
export const sessionService = new SessionService();
