/**
 * E2E Test Helpers Hook
 *
 * Exposes context functions to window for E2E testing.
 * This allows tests to navigate to notebooks using React context functions
 * which properly trigger UI updates.
 */
import { useEffect } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useSession } from '../contexts/SessionContext';

// Extend Window interface for E2E helpers
declare global {
  interface Window {
    __e2e?: {
      openProject: (projectId: string) => Promise<void>;
      addTab: (filePath: string) => Promise<string | null>;
      setActiveTab: (tabId: string) => Promise<void>;
      navigateToNotebook: (projectId: string, filePath: string) => Promise<boolean>;
      getState: () => {
        currentProject: { id: string; name: string; path: string } | null;
        activeTabId: string | null;
        openTabs: Array<{ id: string; filePath: string }>;
      };
    };
  }
}

export function useE2ETestHelpers(): void {
  const { state: projectState, openProject } = useProject();
  const { state: sessionState, addTab, setActiveTab } = useSession();

  useEffect(() => {
    // Always expose E2E helpers for now
    // In a public app, this should be guarded by an E2E flag

    window.__e2e = {
      /**
       * Open a project by ID
       */
      openProject: async (projectId: string) => {
        await openProject(projectId);
      },

      /**
       * Add a tab for a file path
       */
      addTab: async (filePath: string) => {
        return addTab(filePath);
      },

      /**
       * Set the active tab by ID
       */
      setActiveTab: async (tabId: string) => {
        await setActiveTab(tabId);
      },

      /**
       * Combined navigation: open project and navigate to notebook
       * Returns true if successful
       */
      navigateToNotebook: async (projectId: string, filePath: string) => {
        try {
          // First open the project
          await openProject(projectId);

          // Wait a bit for state to settle
          await new Promise(resolve => setTimeout(resolve, 100));

          // Add and activate the tab
          const tabId = await addTab(filePath);
          if (tabId) {
            await setActiveTab(tabId);
            return true;
          }
          return false;
        } catch (err) {
          console.error('E2E navigateToNotebook failed:', err);
          return false;
        }
      },

      /**
       * Get current state for debugging
       */
      getState: () => ({
        currentProject: projectState.currentProject
          ? {
              id: projectState.currentProject.id,
              name: projectState.currentProject.name,
              path: projectState.currentProject.path,
            }
          : null,
        activeTabId: sessionState.session?.activeTabId ?? null,
        openTabs: sessionState.session?.openTabs.map(t => ({
          id: t.id,
          filePath: t.filePath,
        })) ?? [],
      }),
    };

    return () => {
      delete window.__e2e;
    };
  }, [projectState.currentProject, sessionState.session, openProject, addTab, setActiveTab]);
}
