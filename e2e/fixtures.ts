/**
 * Playwright Test Fixtures for Promptbook E2E Tests
 *
 * These fixtures provide reusable test setup and teardown,
 * including app launch, project creation, and kernel management.
 */
import { test as base, expect as baseExpect, Page, Locator } from '@playwright/test';
import { _electron as electron, ElectronApplication } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Test event data captured from the app
 */
export interface TestEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

/**
 * Extended Page with helper methods for Promptbook testing
 */
export interface PromptbookPage extends Page {
  /** Get a cell by its index (0-based) */
  getCell(index: number): Locator;
  /** Get the instructions editor for a cell */
  getCellInstructions(index: number): Locator;
  /** Get the code editor for a cell */
  getCellCode(index: number): Locator;
  /** Get the output area for a cell */
  getCellOutput(index: number): Locator;
  /** Get the run button for a cell */
  getCellRunButton(index: number): Locator;
  /** Get the sync button for a cell */
  getCellSyncButton(index: number): Locator;
  /** Click the add cell button */
  addCell(): Promise<void>;
  /** Get all cells */
  getAllCells(): Locator;
  /** Get tab by name */
  getTab(name: string): Locator;
  /** Get active tab */
  getActiveTab(): Locator;
  /** Get sidebar */
  getSidebar(): Locator;
}

/**
 * Test fixtures available in all tests
 */
export interface TestFixtures {
  /** The Electron application instance */
  electronApp: ElectronApplication;
  /** The main window page with helper methods */
  appPage: PromptbookPage;
  /** Temporary test data directory */
  testDataDir: string;
  /** List of captured test events */
  testEvents: TestEvent[];
  /** Wait for a specific test event */
  waitForEvent: (eventName: string, timeout?: number) => Promise<TestEvent>;
  /** Create a test project */
  createTestProject: (name: string) => Promise<{ id: string; name: string; path: string }>;
  /** Open a test project */
  openTestProject: (projectId: string) => Promise<void>;
  /** Create a test notebook in a project */
  createTestNotebook: (projectId: string, name: string) => Promise<void>;
}

/**
 * Create extended page with Promptbook helpers
 */
function extendPage(page: Page): PromptbookPage {
  const extended = page as PromptbookPage;

  extended.getCell = (index: number) => {
    return page.locator('[data-testid="cell"]').nth(index);
  };

  extended.getCellInstructions = (index: number) => {
    return extended.getCell(index).locator('[data-testid="instructions-editor"]');
  };

  extended.getCellCode = (index: number) => {
    return extended.getCell(index).locator('[data-testid="code-editor"]');
  };

  extended.getCellOutput = (index: number) => {
    return extended.getCell(index).locator('[data-testid="cell-output"]');
  };

  extended.getCellRunButton = (index: number) => {
    return extended.getCell(index).locator('[data-testid="run-button"], button:has-text("Run")');
  };

  extended.getCellSyncButton = (index: number) => {
    return extended.getCell(index).locator('[data-testid="sync-button"], button:has-text("Sync")');
  };

  extended.addCell = async () => {
    await page.locator('[data-testid="add-cell"], button:has-text("Add Cell")').click();
  };

  extended.getAllCells = () => {
    return page.locator('[data-testid="cell"]');
  };

  extended.getTab = (name: string) => {
    return page.locator(`[data-testid="tab"]:has-text("${name}")`);
  };

  extended.getActiveTab = () => {
    return page.locator('[data-testid="tab"][data-active="true"], [data-testid="tab"].active');
  };

  extended.getSidebar = () => {
    return page.locator('[data-testid="sidebar"]');
  };

  return extended;
}

/**
 * Base test with Electron app fixtures
 */
export const test = base.extend<TestFixtures>({
  testDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptbook-e2e-'));
    const projectsDir = path.join(dir, 'projects');
    fs.mkdirSync(projectsDir, { recursive: true });

    console.log('Test data directory:', dir);

    await use(dir);

    // Cleanup after test (unless KEEP_TEST_DATA is set)
    if (process.env.KEEP_TEST_DATA !== 'true') {
      fs.rmSync(dir, { recursive: true, force: true });
    } else {
      console.log('Keeping test data at:', dir);
    }
  },

  testEvents: async ({}, use) => {
    const events: TestEvent[] = [];
    await use(events);
  },

  electronApp: async ({ testDataDir }, use) => {
    // Find the electron entry point
    const electronMain = path.resolve(__dirname, '..', 'dist', 'main', 'index.js');

    // Check if the app is built
    if (!fs.existsSync(electronMain)) {
      throw new Error(
        `Electron app not built. Run 'pnpm build' first.\nExpected: ${electronMain}`
      );
    }

    // Launch Electron
    const app = await electron.launch({
      args: [electronMain],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PROMPTBOOK_TEST_MODE: 'true',
        PROMPTBOOK_DATA_DIR: testDataDir,
        PROMPTBOOK_PROJECTS_DIR: path.join(testDataDir, 'projects'),
      },
    });

    await use(app);

    // Close app after test
    await app.close();
  },

  appPage: async ({ electronApp, testEvents }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Set up test event listener
    await page.exposeFunction('__captureTestEvent', (event: string, data: unknown) => {
      testEvents.push({ event, data, timestamp: Date.now() });
    });

    // Inject event capture into the page
    await page.evaluate(() => {
      // Listen for test events from main process via promptbook API
      // @ts-expect-error - promptbook API not typed in page context
      if (window.promptbook?.test?.onEvent) {
        // @ts-expect-error - custom function
        window.promptbook.test.onEvent((eventName: string, data: unknown) => {
          // @ts-expect-error - exposed function
          window.__captureTestEvent(eventName, data);
        });
      }
    });

    const extended = extendPage(page);
    await use(extended);
  },

  waitForEvent: async ({ testEvents }, use) => {
    const waitForEvent = (eventName: string, timeout = 10000): Promise<TestEvent> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
          const event = testEvents.find((e) => e.event === eventName && e.timestamp >= startTime);
          if (event) {
            resolve(event);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
            return;
          }

          setTimeout(check, 100);
        };

        check();
      });
    };

    await use(waitForEvent);
  },

  createTestProject: async ({ appPage }, use) => {
    const createTestProject = async (name: string) => {
      const result = await appPage.evaluate(async (projectName) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.create(projectName);
      }, name);

      if (!result.success || !result.project) {
        throw new Error(`Failed to create project: ${result.error}`);
      }

      return result.project;
    };

    await use(createTestProject);
  },

  openTestProject: async ({ appPage }, use) => {
    const openTestProject = async (projectId: string) => {
      const result = await appPage.evaluate(async (id) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.open(id);
      }, projectId);

      if (!result.success) {
        throw new Error(`Failed to open project: ${result.error}`);
      }
    };

    await use(openTestProject);
  },

  createTestNotebook: async ({ appPage }, use) => {
    const createTestNotebook = async (projectId: string, name: string) => {
      const relativePath = name.endsWith('.yaml') ? name : `${name}.yaml`;
      const content = `cells: []`;

      const result = await appPage.evaluate(
        async ({ projectId, relativePath, content }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.createFile(projectId, relativePath, content);
        },
        { projectId, relativePath, content }
      );

      if (!result.success) {
        throw new Error(`Failed to create notebook: ${result.error}`);
      }
    };

    await use(createTestNotebook);
  },
});

export { baseExpect as expect };
