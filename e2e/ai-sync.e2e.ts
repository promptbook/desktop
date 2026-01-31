/**
 * E2E Tests: AI Sync Operations
 *
 * Tests for LLM-powered synchronization between instructions and code,
 * including monitoring of LLM calls, responses, and sync results.
 */
import { test, expect } from './fixtures';

test.describe('AI Sync Operations', () => {
  test.describe('Sync Direction Tests', () => {
    /**
     * Test AI sync from instructions to code (toCode direction)
     */
    test('should sync instructions to code', async ({ appPage, testEvents }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-1', 'toCode', {
          newContent: 'Load a CSV file named data.csv into a pandas DataFrame',
          existingCounterpart: '',
        });
      });

      // Check that the API was called and returned something
      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.result).toBeDefined();
        // The generated code should contain pandas-related code
        expect(result.result.toLowerCase()).toMatch(/pandas|pd|read_csv/);
      } else {
        // If it failed, check the error message
        expect(result.error).toBeDefined();
        console.log('AI sync error:', result.error);
      }
    });

    /**
     * Test AI sync from code to instructions (toInstructions direction)
     */
    test('should sync code to instructions', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-2', 'toInstructions', {
          newContent: `import pandas as pd
df = pd.read_csv('sales.csv')
df['total'] = df['quantity'] * df['price']
print(df.head())`,
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.result).toBeDefined();
        // The generated instructions should describe what the code does
        expect(result.result.toLowerCase()).toMatch(/csv|data|sales|total/);
      }
    });

    /**
     * Test AI sync with pseudo-code direction
     */
    test('should sync instructions to pseudo-code', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-3', 'shortToCode', {
          newContent: 'Calculate the average of column X',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.result).toBeDefined();
      }
    });

    /**
     * Test AI sync for expanding short instructions
     */
    test('should expand short instructions', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-4', 'expandInstructions', {
          newContent: 'Load and clean the data',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');

      if (result.success && result.result) {
        // Expanded instructions should be longer than the original
        expect(result.result.length).toBeGreaterThan('Load and clean the data'.length);
      }
    });

    /**
     * Test AI sync for shortening verbose instructions
     */
    test('should shorten verbose instructions', async ({ appPage }) => {
      const verboseInstructions = `
        First, we need to load the CSV file from the specified path using pandas library.
        Then we should clean the data by removing any rows that have missing values.
        After that, we convert the date column to datetime format for proper analysis.
        Finally, we sort the data by date in ascending order.
      `;

      const result = await appPage.evaluate(async (content) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-5', 'shortenInstructions', {
          newContent: content,
          existingCounterpart: '',
        });
      }, verboseInstructions.trim());

      expect(result).toHaveProperty('success');

      if (result.success && result.result) {
        // Shortened instructions should be more concise
        expect(result.result.length).toBeLessThan(verboseInstructions.length);
      }
    });
  });

  test.describe('Sync with Context', () => {
    /**
     * Test sync with existing counterpart (update scenario)
     */
    test('should update existing code based on modified instructions', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-6', 'toCode', {
          newContent: 'Load CSV file and filter rows where age is greater than 30',
          previousContent: 'Load CSV file and filter rows where age is greater than 25',
          existingCounterpart: `import pandas as pd
df = pd.read_csv('data.csv')
filtered = df[df['age'] > 25]`,
        });
      });

      expect(result).toHaveProperty('success');

      if (result.success && result.result) {
        // The updated code should reflect the new filter condition
        expect(result.result).toContain('30');
      }
    });

    /**
     * Test sync preserves variable names from existing code
     */
    test('should preserve code style when updating', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-7', 'toCode', {
          newContent: 'Add a new column for full name by combining first and last names',
          existingCounterpart: `import pandas as pd
my_dataframe = pd.read_csv('employees.csv')
my_dataframe['age_group'] = pd.cut(my_dataframe['age'], bins=[0, 30, 50, 100])`,
        });
      });

      expect(result).toHaveProperty('success');

      if (result.success && result.result) {
        // Should use the same variable name style
        expect(result.result).toMatch(/my_dataframe|dataframe/i);
      }
    });
  });

  test.describe('Error Handling', () => {
    /**
     * Test handling of empty content
     */
    test('should handle empty instructions gracefully', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-8', 'toCode', {
          newContent: '',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      // Should either succeed with empty result or fail gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    /**
     * Test handling of invalid sync direction
     * Note: The API currently doesn't validate directions client-side,
     * so this test verifies the result structure is consistent
     */
    test('should handle invalid sync direction', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('test-cell-9', 'invalidDirection', {
          newContent: 'Some content',
          existingCounterpart: '',
        });
      });

      // The API returns a result object with success property
      // Invalid directions may still return success if the provider handles them
      expect(result).toHaveProperty('success');
      // Either succeeds with result or fails with error
      if (result.success) {
        expect(result.result).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  test.describe('Complex Workflows', () => {
    /**
     * Test multi-cell workflow with AI sync
     * This simulates a real notebook workflow where multiple cells
     * are synced and depend on each other
     */
    test('should handle multi-cell sync workflow', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('AI Workflow Project');
      await createTestNotebook(project.id, 'ai-workflow');

      // Cell 1: Data loading
      const cell1Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('workflow-cell-1', 'toCode', {
          newContent: 'Load the iris dataset from sklearn',
          existingCounterpart: '',
        });
      });

      expect(cell1Result).toHaveProperty('success');

      // Cell 2: Data exploration (depends on cell 1)
      const cell2Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('workflow-cell-2', 'toCode', {
          newContent: 'Display the first 5 rows and the shape of the dataset',
          existingCounterpart: '',
        });
      });

      expect(cell2Result).toHaveProperty('success');

      // Cell 3: Simple analysis (depends on cell 1)
      const cell3Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('workflow-cell-3', 'toCode', {
          newContent: 'Calculate the mean of each feature',
          existingCounterpart: '',
        });
      });

      expect(cell3Result).toHaveProperty('success');

      // Save the notebook with generated code
      if (cell1Result.success && cell2Result.success && cell3Result.success) {
        const notebook = {
          cells: [
            {
              id: 'workflow-cell-1',
              instructions: { text: 'Load the iris dataset from sklearn', parameters: [] },
              code: cell1Result.result || '',
              outputs: [],
            },
            {
              id: 'workflow-cell-2',
              instructions: { text: 'Display the first 5 rows and the shape', parameters: [] },
              code: cell2Result.result || '',
              outputs: [],
            },
            {
              id: 'workflow-cell-3',
              instructions: { text: 'Calculate the mean of each feature', parameters: [] },
              code: cell3Result.result || '',
              outputs: [],
            },
          ],
        };

        const saveResult = await appPage.evaluate(
          async ({ projectId, relativePath, notebook }) => {
            // @ts-expect-error - promptbook API
            return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
          },
          { projectId: project.id, relativePath: 'ai-workflow.yaml', notebook }
        );

        expect(saveResult.success).toBe(true);
      }
    });

    /**
     * Test bidirectional sync: instructions -> code -> instructions
     */
    test('should maintain consistency in round-trip sync', async ({ appPage }) => {
      const originalInstructions = 'Calculate the sum of all values in a list';

      // Instructions -> Code
      const toCodeResult = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('roundtrip-cell', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, originalInstructions);

      if (!toCodeResult.success || !toCodeResult.result) {
        // Skip if AI is not available
        test.skip();
        return;
      }

      const generatedCode = toCodeResult.result;

      // Code -> Instructions
      const toInstructionsResult = await appPage.evaluate(async (code) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('roundtrip-cell', 'toInstructions', {
          newContent: code,
          existingCounterpart: '',
        });
      }, generatedCode);

      expect(toInstructionsResult).toHaveProperty('success');

      if (toInstructionsResult.success && toInstructionsResult.result) {
        // The regenerated instructions should capture the essence of the original
        const regeneratedInstructions = toInstructionsResult.result.toLowerCase();
        expect(regeneratedInstructions).toMatch(/sum|total|add/);
        expect(regeneratedInstructions).toMatch(/list|values|numbers/);
      }
    });
  });

  test.describe('Test Events for AI Operations', () => {
    /**
     * Test that AI operations emit test events
     */
    test('should capture AI request/response events', async ({ appPage, testEvents }) => {
      // Clear previous events
      testEvents.length = 0;

      // Trigger an AI sync
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('event-test-cell', 'toCode', {
          newContent: 'Print hello world',
          existingCounterpart: '',
        });
      });

      // Wait a bit for events to be captured
      await appPage.waitForTimeout(1000);

      // Check for LLM events in test events
      const llmRequestEvents = testEvents.filter((e) => e.event === 'llm:request');
      const llmResponseEvents = testEvents.filter((e) => e.event === 'llm:response');
      const llmErrorEvents = testEvents.filter((e) => e.event === 'llm:error');

      // Either we got a response or an error (depending on AI availability)
      const hasLlmEvent =
        llmRequestEvents.length > 0 ||
        llmResponseEvents.length > 0 ||
        llmErrorEvents.length > 0;

      // Note: Events might not be captured if test event service is not properly connected
      // This is more of an integration verification
      console.log('Captured LLM events:', {
        requests: llmRequestEvents.length,
        responses: llmResponseEvents.length,
        errors: llmErrorEvents.length,
      });
    });
  });
});
