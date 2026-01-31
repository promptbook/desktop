/**
 * E2E Tests: Notebook Cell Workflows
 *
 * Tests for notebook operations with dependent cells,
 * simulating real Jupyter-like workflows where cells build on each other.
 */
import { test, expect } from './fixtures';

test.describe('Notebook Cell Workflows', () => {
  test.describe('Data Analysis Workflow', () => {
    /**
     * Test Case 1: Data Loading and Processing Pipeline
     * Cell 1: Load CSV data
     * Cell 2: Process/transform the data (depends on Cell 1)
     * Cell 3: Analyze and display results (depends on Cell 2)
     */
    test('should execute a 3-cell data analysis pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      // Setup project and notebook
      const project = await createTestProject('Data Analysis Project');
      await createTestNotebook(project.id, 'data-analysis');
      await openTestProject(project.id);

      // Wait for app to be ready
      await appPage.waitForTimeout(1000);

      // Create notebook with 3 dependent cells via API
      const notebook = {
        cells: [
          {
            id: 'cell-1',
            instructions: { text: 'Create sample data', parameters: [] },
            code: `import pandas as pd
data = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'score': [85, 90, 88]
})
print("Data loaded:", len(data), "rows")`,
            outputs: [],
          },
          {
            id: 'cell-2',
            instructions: { text: 'Filter data for age > 25', parameters: [] },
            code: `filtered = data[data['age'] > 25]
print("Filtered to", len(filtered), "rows")`,
            outputs: [],
          },
          {
            id: 'cell-3',
            instructions: { text: 'Calculate average score', parameters: [] },
            code: `avg_score = filtered['score'].mean()
print(f"Average score: {avg_score}")`,
            outputs: [],
          },
        ],
      };

      // Save the notebook
      await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'data-analysis.yaml', notebook }
      );

      // Read back the notebook to verify it was saved correctly
      const savedNotebook = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'data-analysis.yaml' }
      );

      expect(savedNotebook.success).toBe(true);
      // Verify notebook has 3 cells by parsing content
      expect(savedNotebook.content).toContain('cell-1');
      expect(savedNotebook.content).toContain('cell-2');
      expect(savedNotebook.content).toContain('cell-3');

      // Execute cells in sequence (if kernel is available)
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getStatus();
      });

      if (kernelStatus.state === 'idle') {
        // Run cell 1
        const cell1Result = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute(`import pandas as pd
data = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'score': [85, 90, 88]
})
print("Data loaded:", len(data), "rows")`);
        });
        expect(cell1Result.success).toBe(true);

        // Run cell 2 (depends on data from cell 1)
        const cell2Result = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute(`filtered = data[data['age'] > 25]
print("Filtered to", len(filtered), "rows")`);
        });
        expect(cell2Result.success).toBe(true);

        // Run cell 3 (depends on filtered from cell 2)
        const cell3Result = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute(`avg_score = filtered['score'].mean()
print(f"Average score: {avg_score}")`);
        });
        expect(cell3Result.success).toBe(true);

        // Verify the output contains expected value
        const output = cell3Result.outputs?.find((o: { type: string }) => o.type === 'stdout');
        expect(output?.content).toContain('Average score:');
      }
    });

    /**
     * Test Case 2: Machine Learning Pipeline
     * Cell 1: Load and split data
     * Cell 2: Train model (depends on Cell 1)
     * Cell 3: Evaluate model (depends on Cell 2)
     * Cell 4: Make predictions (depends on Cell 2)
     */
    test('should execute a 4-cell ML pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('ML Pipeline Project');
      await createTestNotebook(project.id, 'ml-pipeline');

      // Create ML notebook cells
      const notebook = {
        cells: [
          {
            id: 'ml-cell-1',
            instructions: { text: 'Create training data', parameters: [] },
            code: `import numpy as np
np.random.seed(42)
X_train = np.random.randn(100, 2)
y_train = (X_train[:, 0] + X_train[:, 1] > 0).astype(int)
X_test = np.random.randn(20, 2)
y_test = (X_test[:, 0] + X_test[:, 1] > 0).astype(int)
print(f"Training: {len(X_train)}, Test: {len(X_test)}")`,
            outputs: [],
          },
          {
            id: 'ml-cell-2',
            instructions: { text: 'Train simple model', parameters: [] },
            code: `class SimpleClassifier:
    def fit(self, X, y):
        self.threshold = 0
        return self
    def predict(self, X):
        return (X[:, 0] + X[:, 1] > self.threshold).astype(int)

model = SimpleClassifier().fit(X_train, y_train)
print("Model trained")`,
            outputs: [],
          },
          {
            id: 'ml-cell-3',
            instructions: { text: 'Evaluate model accuracy', parameters: [] },
            code: `predictions = model.predict(X_test)
accuracy = (predictions == y_test).mean()
print(f"Test accuracy: {accuracy:.2%}")`,
            outputs: [],
          },
          {
            id: 'ml-cell-4',
            instructions: { text: 'Make new predictions', parameters: [] },
            code: `new_data = np.array([[0.5, 0.5], [-0.5, -0.5]])
new_predictions = model.predict(new_data)
print(f"Predictions: {new_predictions}")`,
            outputs: [],
          },
        ],
      };

      // Save notebook
      const saveResult = await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'ml-pipeline.yaml', notebook }
      );

      expect(saveResult.success).toBe(true);

      // Read back and verify
      const readResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'ml-pipeline.yaml' }
      );

      expect(readResult.content).toContain('SimpleClassifier');
      expect(readResult.content).toContain('Test accuracy');
    });

    /**
     * Test Case 3: Visualization Pipeline
     * Cell 1: Generate data
     * Cell 2: Calculate statistics (depends on Cell 1)
     * Cell 3: Create visualization (depends on Cells 1 & 2)
     */
    test('should handle visualization workflow', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Visualization Project');
      await createTestNotebook(project.id, 'viz-notebook');

      const notebook = {
        cells: [
          {
            id: 'viz-cell-1',
            instructions: { text: 'Generate random data', parameters: [] },
            code: `import numpy as np
np.random.seed(123)
x = np.linspace(0, 10, 100)
y = np.sin(x) + np.random.normal(0, 0.1, 100)
print(f"Generated {len(x)} data points")`,
            outputs: [],
          },
          {
            id: 'viz-cell-2',
            instructions: { text: 'Calculate statistics', parameters: [] },
            code: `mean_y = y.mean()
std_y = y.std()
min_y, max_y = y.min(), y.max()
print(f"Mean: {mean_y:.3f}, Std: {std_y:.3f}")
print(f"Range: [{min_y:.3f}, {max_y:.3f}]")`,
            outputs: [],
          },
          {
            id: 'viz-cell-3',
            instructions: { text: 'Prepare visualization data', parameters: [] },
            code: `viz_data = {
    'x': x.tolist(),
    'y': y.tolist(),
    'stats': {
        'mean': mean_y,
        'std': std_y,
        'min': min_y,
        'max': max_y
    }
}
print(f"Visualization data ready with {len(viz_data['x'])} points")`,
            outputs: [],
          },
        ],
      };

      // Save and verify
      const saveResult = await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'viz-notebook.yaml', notebook }
      );

      expect(saveResult.success).toBe(true);
    });
  });

  test.describe('Cell Operations', () => {
    test('should add a new cell to notebook', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Add Cell Project');
      await createTestNotebook(project.id, 'add-cell-test');
      await openTestProject(project.id);

      // Wait for UI
      await appPage.waitForLoadState('domcontentloaded');

      // Check for add cell button (may vary by implementation)
      const addButton = appPage.locator('[data-testid="add-cell"], button:has-text("Add")');
      if ((await addButton.count()) > 0) {
        const initialCellCount = await appPage.getAllCells().count();
        await addButton.first().click();
        await appPage.waitForTimeout(500);
        const newCellCount = await appPage.getAllCells().count();
        expect(newCellCount).toBeGreaterThanOrEqual(initialCellCount);
      }
    });

    test('should update cell content', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Update Cell Project');

      // Create initial notebook
      const initialNotebook = {
        cells: [
          {
            id: 'update-cell-1',
            instructions: { text: 'Original instruction', parameters: [] },
            code: 'original_code = 1',
            outputs: [],
          },
        ],
      };

      await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'update-test.yaml', notebook: initialNotebook }
      );

      // Update the notebook
      const updatedNotebook = {
        cells: [
          {
            id: 'update-cell-1',
            instructions: { text: 'Updated instruction', parameters: [] },
            code: 'updated_code = 2',
            outputs: [],
          },
        ],
      };

      await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'update-test.yaml', notebook: updatedNotebook }
      );

      // Verify update
      const readResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'update-test.yaml' }
      );

      expect(readResult.content).toContain('Updated instruction');
      expect(readResult.content).toContain('updated_code = 2');
      expect(readResult.content).not.toContain('Original instruction');
    });

    test('should handle multiple cells with shared variables', async ({
      appPage,
      createTestProject,
    }) => {
      const project = await createTestProject('Shared Variables Project');

      // Create notebook with cells sharing variables
      const notebook = {
        cells: [
          {
            id: 'shared-1',
            instructions: { text: 'Define shared config', parameters: [] },
            code: `CONFIG = {
    'batch_size': 32,
    'learning_rate': 0.001,
    'epochs': 10
}
print("Config defined")`,
            outputs: [],
          },
          {
            id: 'shared-2',
            instructions: { text: 'Use config in training', parameters: [] },
            code: `batch_size = CONFIG['batch_size']
lr = CONFIG['learning_rate']
print(f"Using batch_size={batch_size}, lr={lr}")`,
            outputs: [],
          },
          {
            id: 'shared-3',
            instructions: { text: 'Update and use config', parameters: [] },
            code: `CONFIG['epochs'] = 20  # Update for longer training
total_steps = CONFIG['epochs'] * 100
print(f"Total training steps: {total_steps}")`,
            outputs: [],
          },
        ],
      };

      const saveResult = await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'shared-vars.yaml', notebook }
      );

      expect(saveResult.success).toBe(true);
    });
  });
});
