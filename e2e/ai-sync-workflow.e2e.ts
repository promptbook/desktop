/**
 * E2E Tests: AI Sync Workflow with Tab Persistence
 *
 * These tests verify the full user workflow:
 * 1. Add instructions/code to a cell
 * 2. Sync with AI (strict - must succeed)
 * 3. Switch tabs
 * 4. Return to original tab
 * 5. Verify content persists
 */
import { test, expect } from './fixtures';

test.describe('AI Sync Workflow', () => {
  test.describe('Strict AI Sync Tests', () => {
    /**
     * Test that AI sync actually works and returns valid code
     * This test FAILS if AI provider is not configured or returns errors
     */
    test('should generate valid code from instructions (strict)', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('strict-test-1', 'toCode', {
          newContent: 'Print hello world',
          existingCounterpart: '',
        });
      });

      // STRICT: Must succeed
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.length).toBeGreaterThan(0);

      // Should contain actual Python code
      expect(result.result.toLowerCase()).toMatch(/print/);
    });

    /**
     * Test that AI sync generates valid instructions from code
     */
    test('should generate valid instructions from code (strict)', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('strict-test-2', 'toInstructions', {
          newContent: `x = 5
y = 10
result = x + y
print(f"Sum: {result}")`,
          existingCounterpart: '',
        });
      });

      // STRICT: Must succeed
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.length).toBeGreaterThan(0);
    });

    /**
     * Test pseudocode generation
     */
    test('should generate valid pseudocode from instructions (strict)', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('strict-test-3', 'toPseudo', {
          newContent: 'Sort a list of numbers in ascending order',
          existingCounterpart: '',
        });
      });

      // STRICT: Must succeed
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.length).toBeGreaterThan(0);
    });
  });

  test.describe('Tab Persistence After Sync', () => {
    /**
     * Full workflow test:
     * 1. Create notebook with cell
     * 2. Sync instructions to code
     * 3. Save notebook with synced content
     * 4. Switch to different tab
     * 5. Switch back
     * 6. Verify content is preserved
     */
    test('should preserve synced content after tab switch', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      // Setup
      const project = await createTestProject('Tab Persistence Test');
      await createTestNotebook(project.id, 'notebook-main');
      await createTestNotebook(project.id, 'notebook-other');
      await openTestProject(project.id);

      const instructions = 'Calculate the factorial of a number';

      // Step 1: Sync instructions to code
      const syncResult = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-persist-1', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, instructions);

      // STRICT: Sync must succeed
      expect(syncResult.success).toBe(true);
      expect(syncResult.result).toBeDefined();
      const generatedCode = syncResult.result;

      // Step 2: Save notebook with synced content
      const notebook = {
        cells: [
          {
            id: 'cell-persist-1',
            instructions: { text: instructions, parameters: [] },
            code: generatedCode,
            outputs: [],
          },
        ],
      };

      const saveResult = await appPage.evaluate(
        async ({ projectId, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'notebook-main.yaml', notebook);
        },
        { projectId: project.id, notebook }
      );
      expect(saveResult.success).toBe(true);

      // Step 3: Add tabs and switch
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, {
            id: 'tab-main',
            filePath: 'notebook-main.yaml',
            scrollPosition: 0,
            activeCellId: 'cell-persist-1',
          });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, {
            id: 'tab-other',
            filePath: 'notebook-other.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
        },
        { projectId: project.id }
      );

      // Step 4: Switch to other tab
      const switchAway = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, 'tab-other');
        },
        { projectId: project.id }
      );
      expect(switchAway.success).toBe(true);
      expect(switchAway.session?.activeTabId).toBe('tab-other');

      // Step 5: Switch back to main tab
      const switchBack = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, 'tab-main');
        },
        { projectId: project.id }
      );
      expect(switchBack.success).toBe(true);
      expect(switchBack.session?.activeTabId).toBe('tab-main');

      // Step 6: Read notebook and verify content persisted
      const readResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'notebook-main.yaml');
        },
        { projectId: project.id }
      );

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain(instructions);
      expect(readResult.content).toContain('cell-persist-1');
    });

    /**
     * Test multiple sync operations with tab switching between each
     */
    test('should handle multiple syncs with tab switches', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Multi Sync Test');
      await createTestNotebook(project.id, 'notebook-a');
      await createTestNotebook(project.id, 'notebook-b');
      await openTestProject(project.id);

      // Setup tabs
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, {
            id: 'tab-a',
            filePath: 'notebook-a.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, {
            id: 'tab-b',
            filePath: 'notebook-b.yaml',
            scrollPosition: 0,
            activeCellId: null,
          });
        },
        { projectId: project.id }
      );

      // Sync 1: In notebook A
      const sync1 = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-a-1', 'toCode', {
          newContent: 'Create a list of 10 random numbers',
          existingCounterpart: '',
        });
      });
      expect(sync1.success).toBe(true);

      // Save notebook A
      await appPage.evaluate(
        async ({ projectId, code }) => {
          const notebook = {
            cells: [
              {
                id: 'cell-a-1',
                instructions: { text: 'Create a list of 10 random numbers', parameters: [] },
                code: code,
                outputs: [],
              },
            ],
          };
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'notebook-a.yaml', notebook);
        },
        { projectId: project.id, code: sync1.result }
      );

      // Switch to notebook B
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, 'tab-b');
        },
        { projectId: project.id }
      );

      // Sync 2: In notebook B
      const sync2 = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-b-1', 'toCode', {
          newContent: 'Calculate the mean of a list',
          existingCounterpart: '',
        });
      });
      expect(sync2.success).toBe(true);

      // Save notebook B
      await appPage.evaluate(
        async ({ projectId, code }) => {
          const notebook = {
            cells: [
              {
                id: 'cell-b-1',
                instructions: { text: 'Calculate the mean of a list', parameters: [] },
                code: code,
                outputs: [],
              },
            ],
          };
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'notebook-b.yaml', notebook);
        },
        { projectId: project.id, code: sync2.result }
      );

      // Switch back to notebook A
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, 'tab-a');
        },
        { projectId: project.id }
      );

      // Verify notebook A content persisted
      const readA = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'notebook-a.yaml');
        },
        { projectId: project.id }
      );
      expect(readA.success).toBe(true);
      expect(readA.content).toContain('random');

      // Switch to notebook B and verify
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.session.setActiveTab(projectId, 'tab-b');
        },
        { projectId: project.id }
      );

      const readB = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'notebook-b.yaml');
        },
        { projectId: project.id }
      );
      expect(readB.success).toBe(true);
      expect(readB.content).toContain('mean');
    });
  });

  test.describe('Sync Direction Workflows', () => {
    /**
     * Test the full cycle: instructions -> code -> instructions
     * Verifies round-trip consistency
     */
    test('should maintain consistency in instructions -> code -> instructions cycle', async ({
      appPage,
    }) => {
      const originalInstructions = 'Reverse a string';

      // Step 1: Instructions to code
      const toCodeResult = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('roundtrip-1', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, originalInstructions);

      expect(toCodeResult.success).toBe(true);
      expect(toCodeResult.result).toBeDefined();
      const generatedCode = toCodeResult.result;

      // Code should contain string reversal logic
      expect(generatedCode.toLowerCase()).toMatch(/reverse|::-1/);

      // Step 2: Code back to instructions
      const toInstructionsResult = await appPage.evaluate(async (code) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('roundtrip-1', 'toInstructions', {
          newContent: code,
          existingCounterpart: '',
        });
      }, generatedCode);

      expect(toInstructionsResult.success).toBe(true);
      expect(toInstructionsResult.result).toBeDefined();

      // The regenerated instructions should mention string/reverse
      const regeneratedInstructions = toInstructionsResult.result.toLowerCase();
      expect(regeneratedInstructions).toMatch(/string|reverse|text/);
    });

    /**
     * Test short instructions -> pseudocode -> full code pipeline
     */
    test('should handle short -> pseudo -> code pipeline', async ({ appPage }) => {
      const shortInstructions = 'sort list';

      // Step 1: Expand short to pseudo
      const toPseudoResult = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('pipeline-1', 'shortToPseudo', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, shortInstructions);

      expect(toPseudoResult.success).toBe(true);
      expect(toPseudoResult.result).toBeDefined();
      const pseudoCode = toPseudoResult.result;

      // Step 2: Pseudo to code
      const toCodeResult = await appPage.evaluate(async (pseudo) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('pipeline-1', 'pseudoToCode', {
          newContent: pseudo,
          existingCounterpart: '',
        });
      }, pseudoCode);

      expect(toCodeResult.success).toBe(true);
      expect(toCodeResult.result).toBeDefined();

      // Code should contain sorting logic
      expect(toCodeResult.result.toLowerCase()).toMatch(/sort|sorted/);
    });
  });
});
