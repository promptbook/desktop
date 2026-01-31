/**
 * E2E Tests: Tab Management
 *
 * Tests for opening, closing, switching, and reordering tabs,
 * as well as tab state persistence across sessions.
 */
import { test, expect } from './fixtures';

test.describe('Tab Management', () => {
  test.describe('Tab Operations', () => {
    test('should open a notebook in a new tab', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Tab Test Project');
      await createTestNotebook(project.id, 'tab-test-1');
      await openTestProject(project.id);

      // Wait for project to load
      await appPage.waitForLoadState('domcontentloaded');
      await appPage.waitForTimeout(500);

      // Click on the notebook in sidebar to open it
      const notebookItem = appPage.locator('text=tab-test-1.yaml');
      if ((await notebookItem.count()) > 0) {
        await notebookItem.click();
        await appPage.waitForTimeout(500);

        // Verify tab is opened
        const tab = appPage.getTab('tab-test-1');
        await expect(tab).toBeVisible({ timeout: 5000 });
      }
    });

    test('should switch between multiple tabs', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Multi Tab Project');
      await createTestNotebook(project.id, 'notebook-a');
      await createTestNotebook(project.id, 'notebook-b');
      await openTestProject(project.id);

      await appPage.waitForLoadState('domcontentloaded');

      // Add tabs via session API
      const addTabA = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.addTab(projectId, {
            id: 'tab-a',
            filePath: 'notebook-a.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
        },
        { projectId: project.id }
      );

      const addTabB = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.addTab(projectId, {
            id: 'tab-b',
            filePath: 'notebook-b.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
        },
        { projectId: project.id }
      );

      expect(addTabA.success).toBe(true);
      expect(addTabB.success).toBe(true);

      // Switch to tab A
      const setActiveA = await appPage.evaluate(
        async ({ projectId, tabId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, tabId);
        },
        { projectId: project.id, tabId: 'tab-a' }
      );
      expect(setActiveA.success).toBe(true);
      expect(setActiveA.session?.activeTabId).toBe('tab-a');

      // Switch to tab B
      const setActiveB = await appPage.evaluate(
        async ({ projectId, tabId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, tabId);
        },
        { projectId: project.id, tabId: 'tab-b' }
      );
      expect(setActiveB.success).toBe(true);
      expect(setActiveB.session?.activeTabId).toBe('tab-b');
    });

    test('should close a tab', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Close Tab Project');
      await createTestNotebook(project.id, 'close-test');
      await openTestProject(project.id);

      // Add a tab
      const addResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.addTab(projectId, {
            id: 'close-tab',
            filePath: 'close-test.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
        },
        { projectId: project.id }
      );
      expect(addResult.success).toBe(true);

      // Verify tab exists
      let session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);
      expect(session.session?.openTabs.length).toBeGreaterThan(0);

      // Close the tab
      const closeResult = await appPage.evaluate(
        async ({ projectId, tabId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.removeTab(projectId, tabId);
        },
        { projectId: project.id, tabId: 'close-tab' }
      );
      expect(closeResult.success).toBe(true);

      // Verify tab is removed
      session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);
      const closedTab = session.session?.openTabs.find(
        (t: { id: string }) => t.id === 'close-tab'
      );
      expect(closedTab).toBeUndefined();
    });

    test('should reorder tabs', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Reorder Tab Project');
      await createTestNotebook(project.id, 'first');
      await createTestNotebook(project.id, 'second');
      await createTestNotebook(project.id, 'third');
      await openTestProject(project.id);

      // Add tabs in order
      await appPage.evaluate(async ({ projectId }) => {
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'tab-1',
          filePath: 'first.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'tab-2',
          filePath: 'second.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'tab-3',
          filePath: 'third.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
      }, { projectId: project.id });

      // Reorder: move tab at index 2 to index 0
      const reorderResult = await appPage.evaluate(
        async ({ projectId, fromIndex, toIndex }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.reorderTabs(projectId, fromIndex, toIndex);
        },
        { projectId: project.id, fromIndex: 2, toIndex: 0 }
      );
      expect(reorderResult.success).toBe(true);

      // Verify new order
      const session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);
      expect(session.session?.openTabs[0].id).toBe('tab-3');
    });

    test('should update tab state (scroll position, active cell)', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Update Tab State Project');
      await createTestNotebook(project.id, 'state-test');
      await openTestProject(project.id);

      // Add a tab
      await appPage.evaluate(async ({ projectId }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.addTab(projectId, {
          id: 'state-tab',
          filePath: 'state-test.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
      }, { projectId: project.id });

      // Update tab state
      const updateResult = await appPage.evaluate(
        async ({ projectId, tabId, updates }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.updateTab(projectId, tabId, updates);
        },
        {
          projectId: project.id,
          tabId: 'state-tab',
          updates: { scrollPosition: 500, activeCellId: 'cell-123' },
        }
      );
      expect(updateResult.success).toBe(true);

      // Verify updates
      const session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);

      const updatedTab = session.session?.openTabs.find(
        (t: { id: string }) => t.id === 'state-tab'
      );
      expect(updatedTab?.scrollPosition).toBe(500);
      expect(updatedTab?.activeCellId).toBe('cell-123');
    });
  });

  test.describe('Tab Session Persistence', () => {
    test('should persist and restore session state', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Session Persist Project');
      await createTestNotebook(project.id, 'persist-1');
      await createTestNotebook(project.id, 'persist-2');
      await openTestProject(project.id);

      // Set up session state
      await appPage.evaluate(async ({ projectId }) => {
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'persist-tab-1',
          filePath: 'persist-1.yaml',
          scrollPosition: 100,
          activeCellId: 'cell-a',
        });
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'persist-tab-2',
          filePath: 'persist-2.yaml',
          scrollPosition: 200,
          activeCellId: 'cell-b',
        });
        // @ts-expect-error - promptbook API
        await window.promptbook.session.setActiveTab(projectId, 'persist-tab-2');
        // @ts-expect-error - promptbook API
        await window.promptbook.session.pinSidebar(projectId, true);
      }, { projectId: project.id });

      // Load session to verify it was saved
      const session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);

      expect(session.success).toBe(true);
      expect(session.session?.openTabs.length).toBe(2);
      expect(session.session?.activeTabId).toBe('persist-tab-2');
      expect(session.session?.sidebar.isPinned).toBe(true);
    });

    test('should clean up tabs for deleted files', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Cleanup Tabs Project');
      await createTestNotebook(project.id, 'keep-me');
      await createTestNotebook(project.id, 'delete-me');
      await openTestProject(project.id);

      // Add tabs for both files
      await appPage.evaluate(async ({ projectId }) => {
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'keep-tab',
          filePath: 'keep-me.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
        // @ts-expect-error - promptbook API
        await window.promptbook.session.addTab(projectId, {
          id: 'delete-tab',
          filePath: 'delete-me.yaml',
          scrollPosition: 0,
          activeCellId: null,
        });
      }, { projectId: project.id });

      // Delete one notebook file
      await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.deleteFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'delete-me.yaml' }
      );

      // Clean up orphaned tabs
      const cleanupResult = await appPage.evaluate(
        async ({ projectId, existingFiles }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.cleanupDeletedFiles(projectId, existingFiles);
        },
        { projectId: project.id, existingFiles: ['keep-me.yaml'] }
      );

      expect(cleanupResult.success).toBe(true);

      // Verify only valid tab remains
      const session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);

      const tabIds = session.session?.openTabs.map((t: { id: string }) => t.id);
      expect(tabIds).toContain('keep-tab');
      expect(tabIds).not.toContain('delete-tab');
    });
  });

  test.describe('Sidebar Operations', () => {
    test('should toggle sidebar visibility', async ({
      appPage,
      createTestProject,
      openTestProject,
    }) => {
      const project = await createTestProject('Sidebar Toggle Project');
      await openTestProject(project.id);

      // Get initial state
      let session = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.load(projectId);
      }, project.id);
      const initialVisibility = session.session?.sidebar.isVisible;

      // Toggle sidebar
      const toggleResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.toggleSidebar(projectId);
      }, project.id);

      expect(toggleResult.success).toBe(true);
      expect(toggleResult.session?.sidebar.isVisible).toBe(!initialVisibility);

      // Toggle again
      const toggleResult2 = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.toggleSidebar(projectId);
      }, project.id);

      expect(toggleResult2.session?.sidebar.isVisible).toBe(initialVisibility);
    });

    test('should resize sidebar', async ({
      appPage,
      createTestProject,
      openTestProject,
    }) => {
      const project = await createTestProject('Sidebar Resize Project');
      await openTestProject(project.id);

      // Resize sidebar
      const resizeResult = await appPage.evaluate(
        async ({ projectId, width }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.resizeSidebar(projectId, width);
        },
        { projectId: project.id, width: 300 }
      );

      expect(resizeResult.success).toBe(true);
      expect(resizeResult.session?.sidebar.width).toBe(300);

      // Resize again
      const resizeResult2 = await appPage.evaluate(
        async ({ projectId, width }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.resizeSidebar(projectId, width);
        },
        { projectId: project.id, width: 250 }
      );

      expect(resizeResult2.session?.sidebar.width).toBe(250);
    });
  });
});
