/**
 * Electron Application Helper for Playwright E2E Tests
 *
 * This module provides utilities to launch and interact with the Electron app
 * during E2E testing using Playwright's Electron support.
 */
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ElectronAppFixture {
  app: ElectronApplication;
  page: Page;
  testDataDir: string;
}

/**
 * Configuration for launching the Electron app
 */
export interface LaunchOptions {
  /** Custom test data directory (default: temp dir) */
  testDataDir?: string;
  /** Environment variables to pass to the app */
  env?: Record<string, string>;
  /** Whether to enable test mode events */
  enableTestEvents?: boolean;
  /** Timeout for app launch */
  timeout?: number;
}

/**
 * Launch the Electron application for testing
 */
export async function launchElectronApp(options: LaunchOptions = {}): Promise<ElectronAppFixture> {
  const {
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptbook-test-')),
    env = {},
    enableTestEvents = true,
    timeout = 30000,
  } = options;

  // Create test data directory structure
  const projectsDir = path.join(testDataDir, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });

  // Path to the compiled Electron app
  const electronPath = path.join(__dirname, '..', 'dist', 'main', 'index.js');

  // Launch Electron with test configuration
  const app = await electron.launch({
    args: [electronPath],
    timeout,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PROMPTBOOK_TEST_MODE: 'true',
      PROMPTBOOK_DATA_DIR: testDataDir,
      PROMPTBOOK_PROJECTS_DIR: projectsDir,
      ...env,
    },
  });

  // Get the first window
  const page = await app.firstWindow();

  // Wait for the app to be ready
  await page.waitForLoadState('domcontentloaded');

  return { app, page, testDataDir };
}

/**
 * Close the Electron application and clean up test data
 */
export async function closeElectronApp(fixture: ElectronAppFixture, cleanup = true): Promise<void> {
  await fixture.app.close();

  if (cleanup && fixture.testDataDir.includes('promptbook-test-')) {
    // Clean up test data directory
    fs.rmSync(fixture.testDataDir, { recursive: true, force: true });
  }
}

/**
 * Wait for a specific IPC event in the renderer
 */
export async function waitForTestEvent(
  page: Page,
  eventName: string,
  timeout = 10000
): Promise<unknown> {
  return page.evaluate(
    ({ eventName, timeout }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for test event: ${eventName}`));
        }, timeout);

        // Use the exposed test API from preload
        // @ts-expect-error - accessing promptbook API
        const unsubscribe = window.promptbook?.test?.onEvent?.((name: string, data: unknown) => {
          if (name === eventName) {
            clearTimeout(timer);
            unsubscribe?.();
            resolve(data);
          }
        });

        // If API not available, reject
        if (!unsubscribe) {
          clearTimeout(timer);
          reject(new Error('Test event API not available'));
        }
      });
    },
    { eventName, timeout }
  );
}

/**
 * Execute code in the kernel and wait for completion
 */
export async function executeKernelCode(page: Page, code: string): Promise<{
  success: boolean;
  outputs?: Array<{ type: string; content: string }>;
  error?: string;
}> {
  return page.evaluate(async (code) => {
    // @ts-expect-error - accessing promptbook API
    return window.promptbook.kernel.execute(code);
  }, code);
}

/**
 * Get the current kernel state
 */
export async function getKernelState(page: Page): Promise<{
  state: string;
  executionCount: number;
}> {
  return page.evaluate(async () => {
    // @ts-expect-error - accessing promptbook API
    return window.promptbook.kernel.getStatus();
  });
}

/**
 * Trigger AI sync on a cell
 */
export async function triggerAiSync(
  page: Page,
  cellId: string,
  direction: string,
  context: { newContent: string; previousContent?: string; existingCounterpart?: string }
): Promise<{ success: boolean; result?: string; error?: string }> {
  return page.evaluate(
    async ({ cellId, direction, context }) => {
      // @ts-expect-error - accessing promptbook API
      return window.promptbook.ai.sync(cellId, direction, context);
    },
    { cellId, direction, context }
  );
}

/**
 * Create a new project via the API
 */
export async function createProject(
  page: Page,
  name: string
): Promise<{ success: boolean; project?: { id: string; name: string; path: string } }> {
  return page.evaluate(async (name) => {
    // @ts-expect-error - accessing promptbook API
    return window.promptbook.project.create(name);
  }, name);
}

/**
 * Open a project via the API
 */
export async function openProject(
  page: Page,
  projectId: string
): Promise<{ success: boolean; project?: { id: string; name: string } }> {
  return page.evaluate(async (projectId) => {
    // @ts-expect-error - accessing promptbook API
    return window.promptbook.project.open(projectId);
  }, projectId);
}

/**
 * Create a notebook file in a project
 */
export async function createNotebook(
  page: Page,
  projectId: string,
  relativePath: string
): Promise<{ success: boolean }> {
  const initialContent = `cells: []`;
  return page.evaluate(
    async ({ projectId, relativePath, content }) => {
      // @ts-expect-error - accessing promptbook API
      return window.promptbook.project.createFile(projectId, relativePath, content);
    },
    { projectId, relativePath, content: initialContent }
  );
}

/**
 * Save a notebook to a project
 */
export async function saveNotebook(
  page: Page,
  projectId: string,
  relativePath: string,
  notebook: unknown
): Promise<{ success: boolean }> {
  return page.evaluate(
    async ({ projectId, relativePath, notebook }) => {
      // @ts-expect-error - accessing promptbook API
      return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
    },
    { projectId, relativePath, notebook }
  );
}

/**
 * Read a notebook from a project
 */
export async function readNotebook(
  page: Page,
  projectId: string,
  relativePath: string
): Promise<{ success: boolean; content?: string }> {
  return page.evaluate(
    async ({ projectId, relativePath }) => {
      // @ts-expect-error - accessing promptbook API
      return window.promptbook.project.readFile(projectId, relativePath);
    },
    { projectId, relativePath }
  );
}
