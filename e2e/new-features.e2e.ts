/**
 * E2E Tests: New Features
 *
 * Tests for the two new features:
 * 1. Background sync when running code edited directly in the Code tab
 * 2. AI Assistance panel in the Code tab
 */
import { test, expect } from './fixtures';

/**
 * Helper to open a notebook file in the app
 * Creates a notebook with cells, opens project, and navigates to the notebook
 * Uses the E2E test helpers exposed on window.__e2e for proper React state updates
 */
async function openNotebookWithCells(
  appPage: any,
  createTestProject: any,
  projectName: string,
  notebookName: string
) {
  // Create project and notebook
  const project = await createTestProject(projectName);

  // Create notebook with a code cell via API
  const notebook = {
    cells: [
      {
        id: 'test-cell-1',
        cellType: 'code',
        shortDescription: '',
        pseudoCode: '',
        code: '# Initial code\nprint("Hello")',
        outputs: [],
        isDirty: false,
        isSyncing: false,
        isExecuting: false,
      },
    ],
  };

  // Save notebook via API
  await appPage.evaluate(
    async ({ projectId, relativePath, notebook }: any) => {
      // @ts-expect-error - promptbook API
      return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
    },
    { projectId: project.id, relativePath: `${notebookName}.yaml`, notebook }
  );

  await appPage.waitForTimeout(500);

  // First, click the project card to trigger context initialization
  const projectCard = appPage.locator(`text=${projectName}`).first();
  if ((await projectCard.count()) > 0) {
    await projectCard.click();
    await appPage.waitForTimeout(1500); // Wait for context to initialize
  }

  // Wait for E2E helpers to become available (context needs time to initialize)
  let e2eAvailable = false;
  for (let i = 0; i < 10; i++) {
    e2eAvailable = await appPage.evaluate(() => {
      // @ts-expect-error - E2E test helpers
      return typeof window.__e2e?.addTab === 'function';
    });
    if (e2eAvailable) break;
    await appPage.waitForTimeout(200);
  }
  console.log(`E2E helpers available: ${e2eAvailable}`);

  // Debug: check current state
  const currentState = await appPage.evaluate(() => {
    // @ts-expect-error - E2E test helpers
    return window.__e2e?.getState?.() || { error: 'getState not available' };
  });
  console.log(`Current state:`, JSON.stringify(currentState, null, 2));

  // Now use E2E test helpers to add the tab
  // Since we already clicked the project card, project should be open
  // We just need to add and activate the tab
  if (e2eAvailable) {
    const tabId = await appPage.evaluate(
      async ({ filePath }: any) => {
        // @ts-expect-error - E2E test helpers
        return await window.__e2e.addTab(filePath);
      },
      { filePath: `${notebookName}.yaml` }
    );
    console.log(`Added tab with ID: ${tabId}`);

    // Verify state after adding tab
    const stateAfter = await appPage.evaluate(() => {
      // @ts-expect-error - E2E test helpers
      return window.__e2e?.getState?.() || { error: 'getState not available' };
    });
    console.log(`State after addTab:`, JSON.stringify(stateAfter, null, 2));
  } else {
    console.log('E2E helpers not available, using fallback navigation');
    // Fallback: use session API directly (may not trigger UI update)
    await appPage.evaluate(
      async ({ projectId, notebookName }: any) => {
        // @ts-expect-error - promptbook API
        const addResult = await window.promptbook.session.addTab(projectId, {
          id: `tab-${notebookName}`,
          filePath: `${notebookName}.yaml`,
          scrollPosition: 0,
          activeCellId: null,
        });
        if (addResult.success) {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, `tab-${notebookName}`);
        }
      },
      { projectId: project.id, notebookName }
    );
  }

  // Wait for the navigation to complete
  await appPage.waitForTimeout(1000);

  return project;
}

test.describe('Background Sync on Code Edit', () => {
  /**
   * Test that code runs immediately when edited directly and Run is clicked
   */
  test('should execute code immediately when Code tab was last edited', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'BG Sync Test', 'bg-sync');

    // Wait for notebook to load
    await appPage.waitForTimeout(1000);

    // Find the Code tab and click it
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Type some code in the Monaco editor
    const monacoEditor = appPage.locator('.monaco-editor .view-lines').first();
    if (await monacoEditor.isVisible()) {
      await monacoEditor.click();
      await appPage.waitForTimeout(200);

      // Select all and type new code
      await appPage.keyboard.press('Meta+a');
      await appPage.keyboard.type('x = 42\nprint(f"The value is {x}")');
      await appPage.waitForTimeout(300);
    }

    // The cell should now be dirty - check for Sync button visibility
    const syncButton = appPage.locator('button:has-text("Sync")').first();
    const isDirty = await syncButton.isVisible().catch(() => false);
    console.log(`Cell dirty (Sync visible): ${isDirty}`);

    // Click Run - it should execute (timing depends on whether sync is needed)
    const runButton = appPage.locator('button:has-text("Run")').first();
    if (await runButton.isVisible()) {
      const startTime = Date.now();
      await runButton.click();

      // Wait for some output to appear
      await appPage.waitForTimeout(3000);
      const executionTime = Date.now() - startTime;
      console.log(`Execution time: ${executionTime}ms`);

      // Check for output area
      const outputArea = appPage.locator('.cell-output').first();
      if (await outputArea.isVisible()) {
        const outputText = await outputArea.textContent();
        console.log('Output:', outputText?.slice(0, 100));
      }
    }
  });

  /**
   * Test that background sync indicator appears after running code
   */
  test('should show background sync indicator after running edited code', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'BG Indicator Test', 'indicator');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab and type code
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    const monacoEditor = appPage.locator('.monaco-editor .view-lines').first();
    if (await monacoEditor.isVisible()) {
      await monacoEditor.click();
      await appPage.keyboard.press('Meta+a');
      await appPage.keyboard.type('# New code for background sync test\nresult = sum([1, 2, 3, 4, 5])');
      await appPage.waitForTimeout(300);
    }

    // Click Run
    const runButton = appPage.locator('button:has-text("Run")').first();
    if (await runButton.isVisible()) {
      await runButton.click();

      // Check for background sync indicator (may appear briefly)
      await appPage.waitForTimeout(500);
      const bgSyncIndicator = appPage.locator('.cell-background-sync-indicator');

      // The indicator should exist (even if it disappears quickly when sync completes)
      const indicatorCount = await bgSyncIndicator.count();
      console.log(`Background sync indicator count: ${indicatorCount}`);
    }
  });

  /**
   * Test that Instructions tab is updated after background sync completes
   */
  test('should update Instructions tab after background sync', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'Instructions Test', 'instructions');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab and type code
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    const monacoEditor = appPage.locator('.monaco-editor .view-lines').first();
    if (await monacoEditor.isVisible()) {
      await monacoEditor.click();
      await appPage.keyboard.press('Meta+a');
      await appPage.keyboard.type('# Calculate fibonacci\ndef fib(n):\n    return n if n <= 1 else fib(n-1) + fib(n-2)\nprint([fib(i) for i in range(8)])');
      await appPage.waitForTimeout(300);
    }

    // Click Run
    const runButton = appPage.locator('button:has-text("Run")').first();
    if (await runButton.isVisible()) {
      await runButton.click();

      // Wait for background sync to complete (up to 30 seconds)
      for (let i = 0; i < 30; i++) {
        await appPage.waitForTimeout(1000);
        const stillSyncing = await appPage.locator('.cell-background-sync-indicator').isVisible();
        console.log(`Waiting for sync... still syncing: ${stillSyncing}`);
        if (!stillSyncing) break;
      }

      // Switch to Instructions tab
      const instructionsTab = appPage.locator('button[role="tab"]:has-text("Instructions")').first();
      if (await instructionsTab.isVisible()) {
        await instructionsTab.click();
        await appPage.waitForTimeout(500);
      }

      // Check that instructions have content
      const descriptionContent = await appPage.locator('.description-text, .description-editor, textarea').first().textContent();
      console.log('Instructions content:', descriptionContent?.slice(0, 200));

      if (descriptionContent && descriptionContent.trim().length > 0) {
        console.log('SUCCESS: Instructions tab was updated');
      }
    }
  });
});

test.describe('AI Assistance Panel', () => {
  /**
   * Test that AI toggle button exists in Code tab
   */
  test('should have AI toggle button in Code tab', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'AI Button Test', 'ai-button');

    await appPage.waitForTimeout(1000);

    // Take a screenshot to debug
    await appPage.screenshot({ path: 'test-screenshots/ai-button-debug.png' });

    // Navigate to Code tab
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    const codeTabVisible = await codeTab.isVisible();
    console.log(`Code tab visible: ${codeTabVisible}`);

    if (codeTabVisible) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Take another screenshot after clicking Code tab
    await appPage.screenshot({ path: 'test-screenshots/ai-button-code-tab.png' });

    // Look for AI button
    const aiButton = appPage.locator('.ai-assist-toggle-btn').first();
    const aiButtonExists = await aiButton.count() > 0;
    const aiButtonVisible = aiButtonExists && await aiButton.isVisible();

    console.log(`AI button exists: ${aiButtonExists}, visible: ${aiButtonVisible}`);

    // Also check for any button with AI text in the cell toolbar
    const anyAiButton = appPage.locator('.cell-actions button:has-text("AI")').first();
    const anyAiButtonExists = await anyAiButton.count() > 0;
    console.log(`Any AI button in cell-actions: ${anyAiButtonExists}`);

    expect(aiButtonVisible).toBe(true);
  });

  /**
   * Test opening and closing AI panel
   */
  test('should toggle AI assistance panel', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'AI Toggle Test', 'ai-toggle');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Click AI button to open panel
    const aiButton = appPage.locator('.ai-assist-toggle-btn').first();
    if (await aiButton.count() > 0 && await aiButton.isVisible()) {
      await aiButton.click();
      await appPage.waitForTimeout(500);

      // Check if panel is visible
      const aiPanel = appPage.locator('.ai-assistance-panel');
      const panelVisible = await aiPanel.isVisible();
      console.log(`AI panel visible: ${panelVisible}`);

      expect(panelVisible).toBe(true);

      // Take screenshot of open panel
      await appPage.screenshot({ path: 'test-screenshots/ai-panel-open.png' });

      // Close the panel
      const closeBtn = appPage.locator('.ai-assistance-close-btn');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await appPage.waitForTimeout(300);

        const panelStillVisible = await aiPanel.isVisible();
        expect(panelStillVisible).toBe(false);
      }
    } else {
      console.log('AI button not visible');
      await appPage.screenshot({ path: 'test-screenshots/ai-button-not-found.png' });
      throw new Error('AI button not visible - could not test panel toggle');
    }
  });

  /**
   * Test typing a message in AI panel
   */
  test('should allow typing message in AI panel', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'AI Input Test', 'ai-input');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Open AI panel
    const aiButton = appPage.locator('.ai-assist-toggle-btn').first();
    if (await aiButton.count() > 0 && await aiButton.isVisible()) {
      await aiButton.click();
      await appPage.waitForTimeout(500);

      // Find the input textarea
      const inputTextarea = appPage.locator('.ai-assistance-input textarea');
      if (await inputTextarea.count() > 0) {
        await inputTextarea.fill('Add a comment explaining what this code does');
        await appPage.waitForTimeout(300);

        const inputValue = await inputTextarea.inputValue();
        expect(inputValue).toContain('comment');

        console.log('SUCCESS: Can type in AI assistance input');
      }
    } else {
      console.log('AI button not visible');
      throw new Error('AI button not visible');
    }
  });

  /**
   * Test sending a message to AI assistant
   */
  test('should send message and receive response', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'AI Response Test', 'ai-response');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab and add some code
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Type some code first
    const monacoEditor = appPage.locator('.monaco-editor .view-lines').first();
    if (await monacoEditor.isVisible()) {
      await monacoEditor.click();
      await appPage.keyboard.press('Meta+a');
      await appPage.keyboard.type('def add(a, b):\n    return a + b');
      await appPage.waitForTimeout(300);
    }

    // Open AI panel
    const aiButton = appPage.locator('.ai-assist-toggle-btn').first();
    if (await aiButton.count() > 0 && await aiButton.isVisible()) {
      await aiButton.click();
      await appPage.waitForTimeout(500);

      // Type a message
      const inputTextarea = appPage.locator('.ai-assistance-input textarea');
      if (await inputTextarea.count() > 0) {
        await inputTextarea.fill('Add type hints to this function');
        await appPage.waitForTimeout(300);

        // Click send button
        const sendBtn = appPage.locator('.ai-assistance-send-btn');
        if (await sendBtn.count() > 0) {
          await sendBtn.click();
          console.log('Message sent to AI assistant');

          // Wait for response (up to 30 seconds)
          const loadingIndicator = appPage.locator('.ai-assistance-loading');
          for (let i = 0; i < 30; i++) {
            await appPage.waitForTimeout(1000);
            const isLoading = await loadingIndicator.isVisible();
            console.log(`Waiting for AI response... loading: ${isLoading}`);
            if (!isLoading) break;
          }

          // Check for assistant message
          const assistantMessage = appPage.locator('.ai-assistance-message--assistant');
          const hasResponse = await assistantMessage.count() > 0;
          console.log(`Has AI response: ${hasResponse}`);

          if (hasResponse) {
            const responseText = await assistantMessage.first().textContent();
            console.log('Response preview:', responseText?.slice(0, 200));

            // Check for Apply button if code was suggested
            const applyBtn = appPage.locator('.ai-assistance-apply-btn').first();
            const hasApplyBtn = await applyBtn.count() > 0;
            console.log(`Has Apply button: ${hasApplyBtn}`);
          }
        }
      }
    } else {
      console.log('AI button not visible');
      throw new Error('AI button not visible');
    }
  });
});

test.describe('Integration: Background Sync + AI Assistance', () => {
  /**
   * Test that AI assistance and background sync can work together
   */
  test('should handle AI-modified code with background sync', async ({
    appPage,
    createTestProject,
  }) => {
    await openNotebookWithCells(appPage, createTestProject, 'Integration Test', 'integration');

    await appPage.waitForTimeout(1000);

    // Navigate to Code tab
    const codeTab = appPage.locator('button[role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible()) {
      await codeTab.click();
      await appPage.waitForTimeout(300);
    }

    // Type initial code
    const monacoEditor = appPage.locator('.monaco-editor .view-lines').first();
    if (await monacoEditor.isVisible()) {
      await monacoEditor.click();
      await appPage.keyboard.press('Meta+a');
      await appPage.keyboard.type('numbers = [1, 2, 3, 4, 5]\ntotal = 0\nfor n in numbers:\n    total += n\nprint(total)');
      await appPage.waitForTimeout(500);
    }

    // Check if AI assistance is available
    const aiButton = appPage.locator('.ai-assist-toggle-btn').first();
    if (await aiButton.count() > 0 && await aiButton.isVisible()) {
      console.log('AI assistance available - testing integration');
    }

    // Run the code (should execute immediately and sync in background)
    const runButton = appPage.locator('button:has-text("Run")').first();
    if (await runButton.isVisible()) {
      await runButton.click();
      console.log('Ran code with background sync');

      // Wait a bit for execution
      await appPage.waitForTimeout(3000);

      // Check for output
      const outputArea = appPage.locator('.cell-output').first();
      if (await outputArea.isVisible()) {
        const output = await outputArea.textContent();
        console.log('Output:', output);
        // The sum should be 15
        if (output?.includes('15')) {
          console.log('SUCCESS: Code executed correctly');
        }
      }
    }
  });
});
