import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useProject } from './ProjectContext';

// Types (matching main process types)
export interface TabState {
  id: string;
  filePath: string;
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

// State
interface SessionContextState {
  session: SessionState | null;
  isLoading: boolean;
}

// Actions
type SessionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SESSION'; payload: SessionState | null }
  | { type: 'UPDATE_SESSION'; payload: Partial<SessionState> };

// Reducer
function sessionReducer(state: SessionContextState, action: SessionAction): SessionContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'UPDATE_SESSION':
      if (!state.session) return state;
      return { ...state, session: { ...state.session, ...action.payload } };
    default:
      return state;
  }
}

// Initial state
const initialState: SessionContextState = {
  session: null,
  isLoading: true,
};

// Context type
interface SessionContextType {
  state: SessionContextState;
  // Tab operations
  addTab: (filePath: string) => Promise<string | null>;
  removeTab: (tabId: string) => Promise<void>;
  setActiveTab: (tabId: string) => Promise<void>;
  updateTab: (tabId: string, updates: Partial<Omit<TabState, 'id'>>) => Promise<void>;
  reorderTabs: (fromIndex: number, toIndex: number) => Promise<void>;
  // Sidebar operations
  toggleSidebar: () => Promise<void>;
  pinSidebar: (pinned: boolean) => Promise<void>;
  setSidebarVisible: (visible: boolean) => Promise<void>;
  resizeSidebar: (width: number) => Promise<void>;
  // Helpers
  getActiveTab: () => TabState | null;
  getTabByFilePath: (filePath: string) => TabState | null;
}

// Create context
const SessionContext = createContext<SessionContextType | null>(null);

// Provider
interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const { state: projectState } = useProject();
  const lastProjectId = useRef<string | null>(null);

  // Load session when project changes
  useEffect(() => {
    const projectId = projectState.currentProject?.id;

    // Avoid reloading if same project
    if (projectId === lastProjectId.current) return;
    lastProjectId.current = projectId ?? null;

    if (projectId) {
      loadSession(projectId);
    } else {
      dispatch({ type: 'SET_SESSION', payload: null });
    }
  }, [projectState.currentProject?.id]);

  const loadSession = async (projectId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await window.promptbook.session.load(projectId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Generate unique tab ID
  const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const addTab = useCallback(async (filePath: string): Promise<string | null> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return null;

    // Check if tab already exists
    const existingTab = state.session?.openTabs.find(t => t.filePath === filePath);
    if (existingTab) {
      // Just activate the existing tab
      await setActiveTab(existingTab.id);
      return existingTab.id;
    }

    const newTab: TabState = {
      id: generateTabId(),
      filePath,
      scrollPosition: 0,
      activeCellId: null,
    };

    try {
      const result = await window.promptbook.session.addTab(projectId, newTab);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
        return newTab.id;
      }
    } catch (err) {
      console.error('Failed to add tab:', err);
    }
    return null;
  }, [projectState.currentProject?.id, state.session?.openTabs]);

  const removeTab = useCallback(async (tabId: string): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.removeTab(projectId, tabId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to remove tab:', err);
    }
  }, [projectState.currentProject?.id]);

  const setActiveTab = useCallback(async (tabId: string): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.setActiveTab(projectId, tabId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to set active tab:', err);
    }
  }, [projectState.currentProject?.id]);

  const updateTab = useCallback(async (tabId: string, updates: Partial<Omit<TabState, 'id'>>): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.updateTab(projectId, tabId, updates);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to update tab:', err);
    }
  }, [projectState.currentProject?.id]);

  const reorderTabs = useCallback(async (fromIndex: number, toIndex: number): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.reorderTabs(projectId, fromIndex, toIndex);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to reorder tabs:', err);
    }
  }, [projectState.currentProject?.id]);

  const toggleSidebar = useCallback(async (): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.toggleSidebar(projectId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to toggle sidebar:', err);
    }
  }, [projectState.currentProject?.id]);

  const pinSidebar = useCallback(async (pinned: boolean): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.pinSidebar(projectId, pinned);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to pin sidebar:', err);
    }
  }, [projectState.currentProject?.id]);

  const setSidebarVisible = useCallback(async (visible: boolean): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.updateSidebar(projectId, { isVisible: visible });
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to update sidebar visibility:', err);
    }
  }, [projectState.currentProject?.id]);

  const resizeSidebar = useCallback(async (width: number): Promise<void> => {
    const projectId = projectState.currentProject?.id;
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.resizeSidebar(projectId, width);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to resize sidebar:', err);
    }
  }, [projectState.currentProject?.id]);

  const getActiveTab = useCallback((): TabState | null => {
    if (!state.session?.activeTabId) return null;
    return state.session.openTabs.find(t => t.id === state.session?.activeTabId) || null;
  }, [state.session]);

  const getTabByFilePath = useCallback((filePath: string): TabState | null => {
    return state.session?.openTabs.find(t => t.filePath === filePath) || null;
  }, [state.session?.openTabs]);

  const value: SessionContextType = {
    state,
    addTab,
    removeTab,
    setActiveTab,
    updateTab,
    reorderTabs,
    toggleSidebar,
    pinSidebar,
    setSidebarVisible,
    resizeSidebar,
    getActiveTab,
    getTabByFilePath,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// Hook
export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
