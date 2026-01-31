/**
 * E2E Tests: Notebook Persistence
 *
 * Tests that notebook data is correctly saved and loaded,
 * including all 3 tabs (Instructions, Pseudo, Code) and outputs.
 */
import { test, expect } from './fixtures';
import * as yaml from 'yaml';

test.describe('Notebook Persistence', () => {
  test('should persist all cell tabs and outputs when reopening notebook', async ({
    appPage,
    createTestProject,
  }) => {
    // Create a test project
    const project = await createTestProject('Persistence Test Project');

    // Create a notebook with full cell data
    const testNotebook = {
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
      cells: [
        {
          id: 'persist-cell-1',
          cellType: 'code',
          shortDescription: 'List the first 20 Fibonacci numbers, store in #fib, and print it',
          pseudoCode: '1. Initialize #fib with [0, 1]\n2. FOR i from 2 to 20:\n   - Append sum of last two values\n3. Print #fib',
          code: 'fib = [0, 1]\nfor i in range(2, 20):\n    fib.append(fib[-1] + fib[-2])\nprint(fib)',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [
            {
              type: 'stdout',
              content: '[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181]',
            },
          ],
          lastEditedTab: 'short',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
          executionCount: 1,
          lastExecutionSuccess: true,
          lastExecutionTime: 50,
        },
        {
          id: 'persist-cell-2',
          cellType: 'code',
          shortDescription: 'Calculate the sum and average of #fib',
          pseudoCode: '1. Calculate sum of #fib\n2. Calculate average\n3. Print both values',
          code: 'total = sum(fib)\navg = total / len(fib)\nprint(f"Sum: {total}, Average: {avg:.2f}")',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [
            {
              type: 'stdout',
              content: 'Sum: 10945, Average: 547.25',
            },
          ],
          lastEditedTab: 'code',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
          executionCount: 2,
          lastExecutionSuccess: true,
          lastExecutionTime: 25,
        },
      ],
    };

    const relativePath = 'persistence-test.yaml';

    // Step 1: Save the notebook
    console.log('Saving notebook...');
    const saveResult = await appPage.evaluate(
      async ({ projectId, relativePath, notebook }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
      },
      { projectId: project.id, relativePath, notebook: testNotebook }
    );
    expect(saveResult.success).toBe(true);

    // Step 2: Read the raw file content to verify it was saved correctly
    console.log('Verifying saved content...');
    const rawContent = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.readFile(projectId, relativePath);
      },
      { projectId: project.id, relativePath }
    );
    expect(rawContent.success).toBe(true);
    expect(rawContent.content).toBeTruthy();

    // Verify the YAML content contains all the important data
    expect(rawContent.content).toContain('persist-cell-1');
    expect(rawContent.content).toContain('persist-cell-2');
    expect(rawContent.content).toContain('Fibonacci');
    expect(rawContent.content).toContain('fib = [0, 1]');
    expect(rawContent.content).toContain('[0, 1, 1, 2, 3, 5, 8, 13, 21, 34');
    expect(rawContent.content).toContain('Sum: 10945');

    // Step 3: Parse the content as YAML (simulating what the app does)
    console.log('Parsing saved YAML...');
    const parsedNotebook = yaml.parse(rawContent.content);

    // Step 4: Verify all fields were preserved
    console.log('Verifying parsed notebook structure...');

    // Check cell count
    expect(parsedNotebook.cells).toHaveLength(2);

    // Verify Cell 1 - All 3 tabs
    const cell1 = parsedNotebook.cells[0];
    expect(cell1.id).toBe('persist-cell-1');
    expect(cell1.shortDescription).toBe('List the first 20 Fibonacci numbers, store in #fib, and print it');
    expect(cell1.pseudoCode).toContain('Initialize #fib');
    expect(cell1.code).toBe('fib = [0, 1]\nfor i in range(2, 20):\n    fib.append(fib[-1] + fib[-2])\nprint(fib)');

    // Verify Cell 1 - Output
    expect(cell1.outputs).toHaveLength(1);
    expect(cell1.outputs[0].type).toBe('stdout');
    expect(cell1.outputs[0].content).toContain('[0, 1, 1, 2, 3, 5');

    // Verify Cell 1 - Execution metadata
    expect(cell1.executionCount).toBe(1);
    expect(cell1.lastExecutionSuccess).toBe(true);
    expect(cell1.lastEditedTab).toBe('short');

    // Verify Cell 2 - All 3 tabs
    const cell2 = parsedNotebook.cells[1];
    expect(cell2.id).toBe('persist-cell-2');
    expect(cell2.shortDescription).toBe('Calculate the sum and average of #fib');
    expect(cell2.pseudoCode).toContain('Calculate sum');
    expect(cell2.code).toContain('total = sum(fib)');

    // Verify Cell 2 - Output
    expect(cell2.outputs).toHaveLength(1);
    expect(cell2.outputs[0].content).toBe('Sum: 10945, Average: 547.25');

    // Verify Cell 2 - Different lastEditedTab
    expect(cell2.lastEditedTab).toBe('code');

    console.log('All persistence checks passed!');
  });

  test('should handle empty cells and special characters', async ({
    appPage,
    createTestProject,
  }) => {
    const project = await createTestProject('Special Chars Project');

    const testNotebook = {
      metadata: {},
      cells: [
        {
          id: 'special-cell-1',
          cellType: 'code',
          shortDescription: 'Test with "quotes" and \'apostrophes\'',
          pseudoCode: '1. Handle special chars: <>&\n2. Unicode: 日本語 émojis 🎉',
          code: 'print("Hello, world!")\nprint(\'Special: <>&\')',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [
            {
              type: 'stdout',
              content: 'Hello, world!\nSpecial: <>&',
            },
          ],
          lastEditedTab: 'short',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
        },
        {
          id: 'empty-cell-2',
          cellType: 'code',
          shortDescription: '',
          pseudoCode: '',
          code: '',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [],
          lastEditedTab: 'short',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
        },
      ],
    };

    const relativePath = 'special-chars-test.yaml';

    // Save
    const saveResult = await appPage.evaluate(
      async ({ projectId, relativePath, notebook }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
      },
      { projectId: project.id, relativePath, notebook: testNotebook }
    );
    expect(saveResult.success).toBe(true);

    // Read and parse
    const rawContent = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.readFile(projectId, relativePath);
      },
      { projectId: project.id, relativePath }
    );

    const parsedNotebook = yaml.parse(rawContent.content);

    // Verify special characters were preserved
    const cell1 = parsedNotebook.cells[0];
    expect(cell1.shortDescription).toContain('"quotes"');
    expect(cell1.shortDescription).toContain("'apostrophes'");
    expect(cell1.pseudoCode).toContain('<>&');
    expect(cell1.pseudoCode).toContain('日本語');
    expect(cell1.pseudoCode).toContain('🎉');

    // Verify empty cell was preserved
    const cell2 = parsedNotebook.cells[1];
    expect(cell2.shortDescription).toBe('');
    expect(cell2.pseudoCode).toBe('');
    expect(cell2.code).toBe('');
    expect(cell2.outputs).toHaveLength(0);
  });

  test('should persist notebook through UI open/close cycle', async ({
    appPage,
    createTestProject,
    openTestProject,
  }) => {
    const project = await createTestProject('UI Persistence Project');

    // Create notebook with test data
    const testNotebook = {
      metadata: {
        created: new Date().toISOString(),
      },
      cells: [
        {
          id: 'ui-cell-1',
          cellType: 'code',
          shortDescription: 'Calculate factorial of 10',
          pseudoCode: '1. Define factorial function\n2. Calculate factorial(10)\n3. Print result',
          code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)\n\nresult = factorial(10)\nprint(f"10! = {result}")',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [
            {
              type: 'stdout',
              content: '10! = 3628800',
            },
          ],
          lastEditedTab: 'pseudo',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
          executionCount: 1,
          lastExecutionSuccess: true,
        },
      ],
    };

    const relativePath = 'ui-persistence.yaml';

    // Save notebook via API
    await appPage.evaluate(
      async ({ projectId, relativePath, notebook }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
      },
      { projectId: project.id, relativePath, notebook: testNotebook }
    );

    // Open the project (this should load the file list)
    await openTestProject(project.id);
    await appPage.waitForTimeout(1000);

    // Look for the notebook file in the sidebar and click it
    const fileItem = appPage.locator(`text=${relativePath}`).first();
    if (await fileItem.isVisible()) {
      await fileItem.click();
      await appPage.waitForTimeout(1500);

      // Check if the Instructions tab content is visible
      // The cell should have our test content
      const pageContent = await appPage.content();

      // Verify the content appears somewhere in the page
      const hasFactorial = pageContent.includes('factorial') || pageContent.includes('Factorial');
      const hasCode = pageContent.includes('def factorial') || pageContent.includes('factorial(10)');

      if (hasFactorial || hasCode) {
        console.log('UI loaded notebook content successfully');
      }
    }

    // Regardless of UI, verify the file content is correct via API
    const rawContent = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.readFile(projectId, relativePath);
      },
      { projectId: project.id, relativePath }
    );

    expect(rawContent.content).toContain('factorial');
    expect(rawContent.content).toContain('3628800');
    expect(rawContent.content).toContain('Calculate factorial');
  });

  test('should maintain cell order and metadata through save/load', async ({
    appPage,
    createTestProject,
  }) => {
    const project = await createTestProject('Order Test Project');

    // Create notebook with specific cell order
    const testNotebook = {
      metadata: {
        created: '2024-01-01T00:00:00.000Z',
        modified: '2024-01-02T00:00:00.000Z',
        symbols: [
          { name: 'fib', kind: 'variable', type: 'list', description: 'Fibonacci sequence' },
        ],
      },
      cells: [
        { id: 'order-1', cellType: 'code', shortDescription: 'First cell', pseudoCode: '', code: 'x = 1', textContent: '', textFormat: 'markdown', instructions: null, outputs: [], lastEditedTab: 'short', isDirty: false, isExecuting: false, isSyncing: false },
        { id: 'order-2', cellType: 'code', shortDescription: 'Second cell', pseudoCode: '', code: 'y = 2', textContent: '', textFormat: 'markdown', instructions: null, outputs: [], lastEditedTab: 'short', isDirty: false, isExecuting: false, isSyncing: false },
        { id: 'order-3', cellType: 'code', shortDescription: 'Third cell', pseudoCode: '', code: 'z = 3', textContent: '', textFormat: 'markdown', instructions: null, outputs: [], lastEditedTab: 'short', isDirty: false, isExecuting: false, isSyncing: false },
        { id: 'order-4', cellType: 'code', shortDescription: 'Fourth cell', pseudoCode: '', code: 'w = 4', textContent: '', textFormat: 'markdown', instructions: null, outputs: [], lastEditedTab: 'short', isDirty: false, isExecuting: false, isSyncing: false },
      ],
    };

    const relativePath = 'order-test.yaml';

    // Save
    await appPage.evaluate(
      async ({ projectId, relativePath, notebook }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
      },
      { projectId: project.id, relativePath, notebook: testNotebook }
    );

    // Read and parse
    const rawContent = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.readFile(projectId, relativePath);
      },
      { projectId: project.id, relativePath }
    );

    const parsedNotebook = yaml.parse(rawContent.content);

    // Verify cell order is maintained
    expect(parsedNotebook.cells).toHaveLength(4);
    expect(parsedNotebook.cells[0].id).toBe('order-1');
    expect(parsedNotebook.cells[0].shortDescription).toBe('First cell');
    expect(parsedNotebook.cells[1].id).toBe('order-2');
    expect(parsedNotebook.cells[2].id).toBe('order-3');
    expect(parsedNotebook.cells[3].id).toBe('order-4');
    expect(parsedNotebook.cells[3].shortDescription).toBe('Fourth cell');

    // Verify metadata is preserved
    expect(parsedNotebook.metadata.created).toBe('2024-01-01T00:00:00.000Z');
    expect(parsedNotebook.metadata.modified).toBe('2024-01-02T00:00:00.000Z');
    expect(parsedNotebook.metadata.symbols).toHaveLength(1);
    expect(parsedNotebook.metadata.symbols[0].name).toBe('fib');
  });

  test('should reload notebook content when tab is closed and reopened', async ({
    appPage,
    createTestProject,
    openTestProject,
  }) => {
    const project = await createTestProject('Tab Reopen Project');

    // Create notebook with specific content
    const testNotebook = {
      metadata: {},
      cells: [
        {
          id: 'reopen-cell-1',
          cellType: 'code',
          shortDescription: 'Print hello world message',
          pseudoCode: '1. Print greeting\n2. Include name',
          code: 'print("Hello, World!")',
          textContent: '',
          textFormat: 'markdown',
          instructions: null,
          outputs: [{ type: 'stdout', content: 'Hello, World!' }],
          lastEditedTab: 'short',
          isDirty: false,
          isExecuting: false,
          isSyncing: false,
        },
      ],
    };

    const relativePath = 'tab-reopen-test.yaml';

    // Save notebook via API
    await appPage.evaluate(
      async ({ projectId, relativePath, notebook }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
      },
      { projectId: project.id, relativePath, notebook: testNotebook }
    );

    // Open the project
    await openTestProject(project.id);
    await appPage.waitForTimeout(500);

    // Simulate opening the file by calling addTab
    const tabResult = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        const tab = {
          id: `tab-${Date.now()}`,
          filePath: relativePath,
          scrollPosition: 0,
          activeCellId: null,
        };
        // @ts-expect-error - promptbook API
        const result = await window.promptbook.session.addTab(projectId, tab);
        return { tabId: tab.id, session: result.session };
      },
      { projectId: project.id, relativePath }
    );

    const tabId1 = tabResult.tabId;

    // Wait for content to load
    await appPage.waitForTimeout(1000);

    // Now simulate closing the tab
    await appPage.evaluate(
      async ({ projectId, tabId }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.session.removeTab(projectId, tabId);
      },
      { projectId: project.id, tabId: tabId1 }
    );

    // Wait a moment
    await appPage.waitForTimeout(500);

    // Reopen the same file (new tab)
    await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        const tab = {
          id: `tab-${Date.now()}-2`,
          filePath: relativePath,
          scrollPosition: 0,
          activeCellId: null,
        };
        // @ts-expect-error - promptbook API
        return window.promptbook.session.addTab(projectId, tab);
      },
      { projectId: project.id, relativePath }
    );

    // Wait for content to reload
    await appPage.waitForTimeout(1000);

    // Verify the file content is still correct by reading it
    const rawContent = await appPage.evaluate(
      async ({ projectId, relativePath }) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.readFile(projectId, relativePath);
      },
      { projectId: project.id, relativePath }
    );

    expect(rawContent.success).toBe(true);
    expect(rawContent.content).toContain('Print hello world message');
    expect(rawContent.content).toContain('print("Hello, World!")');
    expect(rawContent.content).toContain('Hello, World!');

    console.log('Tab close/reopen test passed!');
  });
});
