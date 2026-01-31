# Promptbook E2E Tests

Comprehensive end-to-end tests for the Promptbook Electron application using Playwright.

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report
```

## Prerequisites

1. **Build the app first**: Tests require a built Electron app
   ```bash
   pnpm build
   ```

2. **Install Playwright browsers** (first time only):
   ```bash
   npx playwright install
   ```

## Test Suites

### 1. Project Management (`project-management.e2e.ts`)
Tests for project CRUD operations and notebook file management:
- Create, open, rename, delete projects
- Create, rename, delete notebooks
- Folder operations
- Recent projects

### 2. Notebook Workflows (`notebook-workflow.e2e.ts`)
Tests for multi-cell workflows with dependent cells:
- **Data Analysis Pipeline**: 3 cells with data loading, filtering, and analysis
- **ML Pipeline**: 4 cells with training data, model, evaluation, and predictions
- **Visualization Pipeline**: 3 cells with data generation, statistics, and viz prep
- Cell operations (add, update, shared variables)

### 3. Tab Management (`tab-management.e2e.ts`)
Tests for tab and session operations:
- Open, close, switch, reorder tabs
- Tab state persistence (scroll position, active cell)
- Session state save/restore
- Sidebar operations (toggle, resize, pin)

### 4. Kernel Operations (`kernel-operations.e2e.ts`)
Tests for Python kernel functionality:
- Environment scanning and selection
- Code execution (simple, multi-line, dependent cells)
- Error handling
- Kernel control (interrupt, restart)
- Variable and symbol inspection
- Kernel events

### 5. AI Sync (`ai-sync.e2e.ts`)
Tests for LLM-powered synchronization:
- Instructions to code sync
- Code to instructions sync
- Expand/shorten instructions
- Sync with existing context
- Multi-cell AI workflow
- Round-trip consistency

## Test Architecture

### Fixtures (`fixtures.ts`)
- `electronApp`: Launches the Electron application
- `appPage`: Extended Page with Promptbook helpers
- `testDataDir`: Temporary test data directory
- `testEvents`: Captured test events
- `waitForEvent`: Wait for specific test events
- Helper functions for project/notebook creation

### Test Event Service
The `TestEventService` in the main process emits events for:
- LLM requests/responses
- Kernel execution start/complete
- Project/notebook operations
- Tab operations

### Page Helpers
The `PromptbookPage` interface provides:
- `getCell(index)`: Get cell by index
- `getCellInstructions(index)`: Get instructions editor
- `getCellCode(index)`: Get code editor
- `getCellOutput(index)`: Get output area
- `getCellRunButton(index)`: Get run button
- `addCell()`: Add new cell
- `getTab(name)`: Get tab by name
- `getSidebar()`: Get sidebar

## Environment Variables

- `PROMPTBOOK_TEST_MODE=true`: Enables test event service
- `PROMPTBOOK_DATA_DIR`: Custom data directory
- `PROMPTBOOK_PROJECTS_DIR`: Custom projects directory

## Writing New Tests

```typescript
import { test, expect } from './fixtures';

test.describe('My Feature', () => {
  test('should do something', async ({
    appPage,
    createTestProject,
    createTestNotebook,
  }) => {
    // Create test data
    const project = await createTestProject('Test Project');
    await createTestNotebook(project.id, 'test-notebook');

    // Interact with the app
    const result = await appPage.evaluate(async () => {
      return window.promptbook.someApi.someMethod();
    });

    // Assert
    expect(result.success).toBe(true);
  });
});
```

## Debugging

1. Use `--debug` flag to run tests with Playwright Inspector
2. Use `test.only()` to run a single test
3. Use `await page.pause()` to pause execution
4. Check `test-results/` for failure artifacts (screenshots, videos)
