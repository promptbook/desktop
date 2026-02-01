/**
 * E2E Tests: Parameter Detection in AI Sync
 *
 * Tests that explicit values in instructions are converted to {{name:value}} parameters.
 */
import { test, expect } from './fixtures';

test.describe('Parameter Detection', () => {
  test.describe('Numeric Parameters', () => {
    test('should detect count parameter in Fibonacci example', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-1', 'shortenInstructions', {
          newContent: 'Generate the first 20 Fibonacci numbers, store them in #fib, and print the list',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert 20 to {{count:20}}
        expect(result.result).toMatch(/\{\{count:20\}\}|\{\{n:20\}\}|\{\{num:20\}\}/i);
        // Should NOT add implementation details like "iterative"
        expect(result.result.toLowerCase()).not.toContain('iterative');
        expect(result.result.toLowerCase()).not.toContain('recursive');
        expect(result.result.toLowerCase()).not.toContain('loop');
      }
    });

    test('should detect threshold parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-2', 'shortenInstructions', {
          newContent: 'Filter the dataframe where price is above 100',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert 100 to a parameter
        expect(result.result).toMatch(/\{\{threshold:100\}\}|\{\{min_price:100\}\}|\{\{value:100\}\}/i);
      }
    });

    test('should detect limit parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-3', 'shortenInstructions', {
          newContent: 'Get the top 5 users by score',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert 5 to a parameter
        expect(result.result).toMatch(/\{\{limit:5\}\}|\{\{count:5\}\}|\{\{top:5\}\}|\{\{n:5\}\}/i);
      }
    });
  });

  test.describe('File Parameters', () => {
    test('should detect file parameter in CSV loading', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-4', 'shortenInstructions', {
          newContent: 'Load data from sales.csv and calculate the total',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert sales.csv to a parameter
        expect(result.result).toMatch(/\{\{file:sales\.csv\}\}|\{\{input:sales\.csv\}\}|\{\{path:sales\.csv\}\}/i);
      }
    });

    test('should detect output file parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-5', 'shortenInstructions', {
          newContent: 'Save the results to output.json',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert output.json to a parameter
        expect(result.result).toMatch(/\{\{output:output\.json\}\}|\{\{output_file:output\.json\}\}|\{\{file:output\.json\}\}|\{\{path:output\.json\}\}/i);
      }
    });
  });

  test.describe('Date Parameters', () => {
    test('should detect date parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-6', 'shortenInstructions', {
          newContent: 'Filter records from January 2024 to March 2024',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert dates to parameters
        expect(result.result).toMatch(/\{\{start_date:January 2024\}\}|\{\{from:January 2024\}\}/i);
        expect(result.result).toMatch(/\{\{end_date:March 2024\}\}|\{\{to:March 2024\}\}/i);
      }
    });

    test('should detect ISO date parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-7', 'shortenInstructions', {
          newContent: 'Get all entries after 2024-01-15',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert ISO date to a parameter
        expect(result.result).toMatch(/\{\{date:2024-01-15\}\}|\{\{start_date:2024-01-15\}\}|\{\{after:2024-01-15\}\}/i);
      }
    });
  });

  test.describe('String Parameters', () => {
    test('should detect column name parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-8', 'shortenInstructions', {
          newContent: 'Calculate the average of the price column',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert "price" to a parameter
        expect(result.result).toMatch(/\{\{column:price\}\}|\{\{field:price\}\}/i);
      }
    });

    test('should detect username parameter', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-9', 'shortenInstructions', {
          newContent: 'Connect to the database as user admin',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should convert "admin" to a parameter
        expect(result.result).toMatch(/\{\{user:admin\}\}|\{\{username:admin\}\}/i);
      }
    });
  });

  test.describe('Anti-Elaboration', () => {
    test('should NOT add implementation details', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-10', 'shortenInstructions', {
          newContent: 'Generate the first 20 Fibonacci numbers',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should NOT add implementation words
        const lower = result.result.toLowerCase();
        expect(lower).not.toContain('iterative');
        expect(lower).not.toContain('recursive');
        expect(lower).not.toContain('using a loop');
        expect(lower).not.toContain('using an array');
      }
    });

    test('should preserve original abstraction level', async ({ appPage }) => {
      const original = 'Load CSV and filter by date';
      const result = await appPage.evaluate(async (content) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-11', 'shortenInstructions', {
          newContent: content,
          existingCounterpart: '',
        });
      }, original);

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Result should be similar length (not much longer)
        expect(result.result.length).toBeLessThan(original.length * 2);
      }
    });
  });

  test.describe('Combined Parameters', () => {
    test('should detect multiple parameters in one instruction', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('param-test-12', 'shortenInstructions', {
          newContent: 'Load sales.csv, filter rows where price > 100, and save top 10 to output.json',
          existingCounterpart: '',
        });
      });

      expect(result).toHaveProperty('success');
      console.log('Result:', result);

      if (result.success && result.result) {
        // Should detect all parameters
        const text = result.result;
        // File parameters
        expect(text).toMatch(/\{\{.*sales\.csv.*\}\}/i);
        // Threshold parameter
        expect(text).toMatch(/\{\{.*100.*\}\}/i);
        // Limit parameter
        expect(text).toMatch(/\{\{.*10.*\}\}/i);
        // Output file
        expect(text).toMatch(/\{\{.*output\.json.*\}\}/i);
      }
    });
  });
});
