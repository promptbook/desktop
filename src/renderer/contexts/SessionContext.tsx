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

// Generate unique tab ID
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Helper type for dispatch function
type SessionDispatch = React.Dispatch<SessionAction>;

// Tab operations factory
function createTabOperations(
  getProjectId: () => string | undefined,
  getOpenTabs: () => TabState[] | undefined,
  dispatch: SessionDispatch
) {
  const addTab = async (filePath: string): Promise<string | null> => {
    const projectId = getProjectId();
    if (!projectId) return null;

    // Check if tab already exists
    const existingTab = getOpenTabs()?.find(t => t.filePath === filePath);
    if (existingTab) {
      // Just activate the existing tab
      try {
        const result = await window.promptbook.session.setActiveTab(projectId, existingTab.id);
        if (result.success && result.session) {
          dispatch({ type: 'SET_SESSION', payload: result.session });
        }
      } catch (err) {
        console.error('Failed to set active tab:', err);
      }
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
  };

  const removeTab = async (tabId: string): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.removeTab(projectId, tabId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to remove tab:', err);
    }
  };

  const setActiveTab = async (tabId: string): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.setActiveTab(projectId, tabId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to set active tab:', err);
    }
  };

  const updateTab = async (tabId: string, updates: Partial<Omit<TabState, 'id'>>): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.updateTab(projectId, tabId, updates);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to update tab:', err);
    }
  };

  const reorderTabs = async (fromIndex: number, toIndex: number): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.reorderTabs(projectId, fromIndex, toIndex);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to reorder tabs:', err);
    }
  };

  return { addTab, removeTab, setActiveTab, updateTab, reorderTabs };
}

// Sidebar operations factory
function createSidebarOperations(
  getProjectId: () => string | undefined,
  dispatch: SessionDispatch
) {
  const toggleSidebar = async (): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.toggleSidebar(projectId);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to toggle sidebar:', err);
    }
  };

  const pinSidebar = async (pinned: boolean): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.pinSidebar(projectId, pinned);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to pin sidebar:', err);
    }
  };

  const setSidebarVisible = async (visible: boolean): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.updateSidebar(projectId, { isVisible: visible });
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to update sidebar visibility:', err);
    }
  };

  const resizeSidebar = async (width: number): Promise<void> => {
    const projectId = getProjectId();
    if (!projectId) return;

    try {
      const result = await window.promptbook.session.resizeSidebar(projectId, width);
      if (result.success && result.session) {
        dispatch({ type: 'SET_SESSION', payload: result.session });
      }
    } catch (err) {
      console.error('Failed to resize sidebar:', err);
    }
  };

  return { toggleSidebar, pinSidebar, setSidebarVisible, resizeSidebar };
}

// Helper functions factory
function createHelperOperations(getSession: () => SessionState | null) {
  const getActiveTab = (): TabState | null => {
    const session = getSession();
    if (!session?.activeTabId) return null;
    return session.openTabs.find(t => t.id === session.activeTabId) || null;
  };

  const getTabByFilePath = (filePath: string): TabState | null => {
    const session = getSession();
    return session?.openTabs.find(t => t.filePath === filePath) || null;
  };

  return { getActiveTab, getTabByFilePath };
}

// Provider
interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const { state: projectState } = useProject();
  const lastProjectId = useRef<string | null>(null);

  // Stable getters for factory functions
  const getProjectId = useCallback(() => projectState.currentProject?.id, [projectState.currentProject?.id]);
  const getOpenTabs = useCallback(() => state.session?.openTabs, [state.session?.openTabs]);
  const getSession = useCallback(() => state.session, [state.session]);

  // Load session when project changes
  useEffect(() => {
    const projectId = projectState.currentProject?.id;

    // Avoid reloading if same project
    if (projectId === lastProjectId.current) return;
    lastProjectId.current = projectId ?? null;

    const loadSession = async (id: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const result = await window.promptbook.session.load(id);
        if (result.success && result.session) {
          dispatch({ type: 'SET_SESSION', payload: result.session });
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    if (projectId) {
      loadSession(projectId);
    } else {
      dispatch({ type: 'SET_SESSION', payload: null });
    }
  }, [projectState.currentProject?.id]);

  // Create operations using factories
  const tabOps = createTabOperations(getProjectId, getOpenTabs, dispatch);
  const sidebarOps = createSidebarOperations(getProjectId, dispatch);
  const helperOps = createHelperOperations(getSession);

  const value: SessionContextType = {
    state,
    addTab: tabOps.addTab,
    removeTab: tabOps.removeTab,
    setActiveTab: tabOps.setActiveTab,
    updateTab: tabOps.updateTab,
    reorderTabs: tabOps.reorderTabs,
    toggleSidebar: sidebarOps.toggleSidebar,
    pinSidebar: sidebarOps.pinSidebar,
    setSidebarVisible: sidebarOps.setSidebarVisible,
    resizeSidebar: sidebarOps.resizeSidebar,
    getActiveTab: helperOps.getActiveTab,
    getTabByFilePath: helperOps.getTabByFilePath,
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
