/**
 * E2E Tests: Realistic Data Science Workflows
 *
 * These tests simulate real data science workflows with:
 * - Multiple dependent cells
 * - Actual data loading, analysis, and visualization scenarios
 * - Tab switching between notebooks
 * - Content persistence verification
 */
import { test, expect } from './fixtures';

test.describe('Data Science Workflows', () => {
  /**
   * Scenario 1: Data Loading and Cleaning Pipeline
   *
   * Cell 1: Load CSV data
   * Cell 2: Inspect data shape and types
   * Cell 3: Handle missing values
   * Cell 4: Save cleaned data
   */
  test.describe('Scenario 1: Data Loading and Cleaning', () => {
    test('should sync all cells in data cleaning pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Data Cleaning Project');
      await createTestNotebook(project.id, 'data-cleaning');
      await createTestNotebook(project.id, 'other-notebook');
      await openTestProject(project.id);

      // Cell 1: Load CSV
      const cell1Instructions = 'Load a CSV file named sales_data.csv into a pandas DataFrame called df';
      const cell1Result = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-1', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, cell1Instructions);

      expect(cell1Result.success).toBe(true);
      expect(cell1Result.result).toMatch(/pd\.read_csv|pandas/i);

      // Cell 2: Inspect data (depends on df from Cell 1)
      const cell2Instructions = 'Display the shape of the DataFrame and show the first 5 rows using df variable from previous cell';
      const cell2Result = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-2', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, cell2Instructions);

      expect(cell2Result.success).toBe(true);
      expect(cell2Result.result).toMatch(/\.shape|\.head|df/i);

      // Cell 3: Handle missing values (depends on df)
      const cell3Instructions = 'Fill missing values in the DataFrame df with the column mean for numeric columns';
      const cell3Result = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-3', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, cell3Instructions);

      expect(cell3Result.success).toBe(true);
      expect(cell3Result.result).toMatch(/fillna|mean|df/i);

      // Cell 4: Save cleaned data
      const cell4Instructions = 'Save the cleaned DataFrame to a new CSV file named cleaned_sales.csv';
      const cell4Result = await appPage.evaluate(async (instructions) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('cell-4', 'toCode', {
          newContent: instructions,
          existingCounterpart: '',
        });
      }, cell4Instructions);

      expect(cell4Result.success).toBe(true);
      expect(cell4Result.result).toMatch(/to_csv|cleaned/i);

      // Save notebook with all cells
      const notebook = {
        cells: [
          { id: 'cell-1', instructions: { text: cell1Instructions, parameters: [] }, code: cell1Result.result, outputs: [] },
          { id: 'cell-2', instructions: { text: cell2Instructions, parameters: [] }, code: cell2Result.result, outputs: [] },
          { id: 'cell-3', instructions: { text: cell3Instructions, parameters: [] }, code: cell3Result.result, outputs: [] },
          { id: 'cell-4', instructions: { text: cell4Instructions, parameters: [] }, code: cell4Result.result, outputs: [] },
        ],
      };

      await appPage.evaluate(
        async ({ projectId, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'data-cleaning.yaml', notebook);
        },
        { projectId: project.id, notebook }
      );

      // Switch tabs and verify persistence
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-1', filePath: 'data-cleaning.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-2', filePath: 'other-notebook.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'tab-2');
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'tab-1');
        },
        { projectId: project.id }
      );

      // Verify content persisted
      const readResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'data-cleaning.yaml');
        },
        { projectId: project.id }
      );

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('cell-1');
      expect(readResult.content).toContain('cell-4');
      expect(readResult.content).toContain('sales_data');
    });
  });

  /**
   * Scenario 2: Exploratory Data Analysis
   *
   * Cell 1: Load dataset
   * Cell 2: Calculate summary statistics
   * Cell 3: Group by category and aggregate
   * Cell 4: Find correlations
   */
  test.describe('Scenario 2: Exploratory Data Analysis', () => {
    test('should sync all cells in EDA pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('EDA Project');
      await createTestNotebook(project.id, 'eda-notebook');
      await createTestNotebook(project.id, 'scratch');
      await openTestProject(project.id);

      // Cell 1: Load dataset
      const cell1Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('eda-1', 'toCode', {
          newContent: 'Load the iris dataset from sklearn and convert to a pandas DataFrame with column names',
          existingCounterpart: '',
        });
      });
      expect(cell1Result.success).toBe(true);
      expect(cell1Result.result).toMatch(/sklearn|iris|DataFrame/i);

      // Cell 2: Summary statistics
      const cell2Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('eda-2', 'toCode', {
          newContent: 'Calculate and display summary statistics for all numeric columns in the DataFrame',
          existingCounterpart: '',
        });
      });
      expect(cell2Result.success).toBe(true);
      expect(cell2Result.result).toMatch(/describe|mean|std/i);

      // Cell 3: Group by and aggregate
      const cell3Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('eda-3', 'toCode', {
          newContent: 'Group the data by species/target and calculate the mean of each feature',
          existingCounterpart: '',
        });
      });
      expect(cell3Result.success).toBe(true);
      expect(cell3Result.result).toMatch(/groupby|mean|species|target/i);

      // Cell 4: Correlation analysis
      const cell4Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('eda-4', 'toCode', {
          newContent: 'Calculate the correlation matrix between all numeric features and display it',
          existingCounterpart: '',
        });
      });
      expect(cell4Result.success).toBe(true);
      expect(cell4Result.result).toMatch(/corr|correlation/i);

      // Save and verify persistence after tab switch
      const notebook = {
        cells: [
          { id: 'eda-1', instructions: { text: 'Load iris dataset', parameters: [] }, code: cell1Result.result, outputs: [] },
          { id: 'eda-2', instructions: { text: 'Summary statistics', parameters: [] }, code: cell2Result.result, outputs: [] },
          { id: 'eda-3', instructions: { text: 'Group by species', parameters: [] }, code: cell3Result.result, outputs: [] },
          { id: 'eda-4', instructions: { text: 'Correlation matrix', parameters: [] }, code: cell4Result.result, outputs: [] },
        ],
      };

      await appPage.evaluate(
        async ({ projectId, notebook }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.project.saveNotebook(projectId, 'eda-notebook.yaml', notebook);
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-eda', filePath: 'eda-notebook.yaml', scrollPosition: 0, activeCellId: 'eda-1' });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-scratch', filePath: 'scratch.yaml', scrollPosition: 0, activeCellId: null });
        },
        { projectId: project.id, notebook }
      );

      // Switch tabs multiple times
      for (let i = 0; i < 3; i++) {
        await appPage.evaluate(
          async ({ projectId }) => {
            // @ts-expect-error - promptbook API
            await window.promptbook.session.setActiveTab(projectId, 'tab-scratch');
            // @ts-expect-error - promptbook API
            await window.promptbook.session.setActiveTab(projectId, 'tab-eda');
          },
          { projectId: project.id }
        );
      }

      // Verify content still there
      const readResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'eda-notebook.yaml');
        },
        { projectId: project.id }
      );
      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('iris');
      expect(readResult.content).toContain('corr');
    });
  });

  /**
   * Scenario 3: Data Visualization Pipeline
   *
   * Cell 1: Load and prepare data
   * Cell 2: Create bar chart
   * Cell 3: Create scatter plot
   * Cell 4: Create histogram
   */
  test.describe('Scenario 3: Data Visualization', () => {
    test('should sync all cells in visualization pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Visualization Project');
      await createTestNotebook(project.id, 'viz-notebook');
      await createTestNotebook(project.id, 'backup');
      await openTestProject(project.id);

      // Cell 1: Load and prepare data
      const cell1Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('viz-1', 'toCode', {
          newContent: 'Import matplotlib and seaborn, then create sample sales data with columns: month, revenue, units_sold',
          existingCounterpart: '',
        });
      });
      expect(cell1Result.success).toBe(true);
      expect(cell1Result.result).toMatch(/matplotlib|seaborn|import/i);

      // Cell 2: Bar chart
      const cell2Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('viz-2', 'toCode', {
          newContent: 'Create a bar chart showing monthly revenue using the sales data',
          existingCounterpart: '',
        });
      });
      expect(cell2Result.success).toBe(true);
      expect(cell2Result.result).toMatch(/bar|plt\.|plot/i);

      // Cell 3: Scatter plot
      const cell3Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('viz-3', 'toCode', {
          newContent: 'Create a scatter plot showing the relationship between units_sold and revenue',
          existingCounterpart: '',
        });
      });
      expect(cell3Result.success).toBe(true);
      expect(cell3Result.result).toMatch(/scatter|plt\./i);

      // Cell 4: Histogram
      const cell4Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('viz-4', 'toCode', {
          newContent: 'Create a histogram showing the distribution of revenue values with 10 bins',
          existingCounterpart: '',
        });
      });
      expect(cell4Result.success).toBe(true);
      expect(cell4Result.result).toMatch(/hist|bins/i);

      // Save notebook
      const notebook = {
        cells: [
          { id: 'viz-1', instructions: { text: 'Setup and data', parameters: [] }, code: cell1Result.result, outputs: [] },
          { id: 'viz-2', instructions: { text: 'Bar chart', parameters: [] }, code: cell2Result.result, outputs: [] },
          { id: 'viz-3', instructions: { text: 'Scatter plot', parameters: [] }, code: cell3Result.result, outputs: [] },
          { id: 'viz-4', instructions: { text: 'Histogram', parameters: [] }, code: cell4Result.result, outputs: [] },
        ],
      };

      const saveResult = await appPage.evaluate(
        async ({ projectId, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'viz-notebook.yaml', notebook);
        },
        { projectId: project.id, notebook }
      );
      expect(saveResult.success).toBe(true);

      // Tab switching
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'viz-tab', filePath: 'viz-notebook.yaml', scrollPosition: 0, activeCellId: 'viz-1' });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'backup-tab', filePath: 'backup.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'backup-tab');
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'viz-tab');
        },
        { projectId: project.id }
      );

      // Verify persistence
      const readResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'viz-notebook.yaml');
        },
        { projectId: project.id }
      );
      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('viz-1');
      expect(readResult.content).toContain('viz-4');
    });
  });

  /**
   * Scenario 4: Machine Learning Pipeline
   *
   * Cell 1: Load and split data
   * Cell 2: Feature preprocessing
   * Cell 3: Train model
   * Cell 4: Evaluate model
   * Cell 5: Make predictions
   */
  test.describe('Scenario 4: Machine Learning Pipeline', () => {
    test('should sync all cells in ML pipeline', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      // Increase timeout for this test since it has many AI syncs
      test.setTimeout(120000);
      const project = await createTestProject('ML Project');
      await createTestNotebook(project.id, 'ml-pipeline');
      await createTestNotebook(project.id, 'experiments');
      await openTestProject(project.id);

      // Cell 1: Load and split data
      const cell1Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('ml-1', 'toCode', {
          newContent: 'Load the breast cancer dataset from sklearn and split into training and test sets with 80/20 ratio',
          existingCounterpart: '',
        });
      });
      expect(cell1Result.success).toBe(true);
      expect(cell1Result.result).toMatch(/train_test_split|breast_cancer|sklearn/i);

      // Cell 2: Feature preprocessing
      const cell2Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('ml-2', 'toCode', {
          newContent: 'Scale the features using StandardScaler, fit on training data and transform both train and test sets',
          existingCounterpart: '',
        });
      });
      expect(cell2Result.success).toBe(true);
      expect(cell2Result.result).toMatch(/StandardScaler|fit|transform/i);

      // Cell 3: Train model
      const cell3Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('ml-3', 'toCode', {
          newContent: 'Create and train a Random Forest classifier with 100 trees on the scaled training data',
          existingCounterpart: '',
        });
      });
      expect(cell3Result.success).toBe(true);
      expect(cell3Result.result).toMatch(/RandomForest|fit|n_estimators/i);

      // Cell 4: Evaluate model
      const cell4Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('ml-4', 'toCode', {
          newContent: 'Calculate and print the accuracy score and classification report on the test set',
          existingCounterpart: '',
        });
      });
      expect(cell4Result.success).toBe(true);
      expect(cell4Result.result).toMatch(/accuracy|classification_report|score/i);

      // Cell 5: Make predictions
      const cell5Result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('ml-5', 'toCode', {
          newContent: 'Make predictions on the test set and create a confusion matrix visualization',
          existingCounterpart: '',
        });
      });
      expect(cell5Result.success).toBe(true);
      expect(cell5Result.result).toMatch(/predict|confusion_matrix/i);

      // Save the complete ML pipeline notebook
      const notebook = {
        cells: [
          { id: 'ml-1', instructions: { text: 'Load and split data', parameters: [] }, code: cell1Result.result, outputs: [] },
          { id: 'ml-2', instructions: { text: 'Scale features', parameters: [] }, code: cell2Result.result, outputs: [] },
          { id: 'ml-3', instructions: { text: 'Train Random Forest', parameters: [] }, code: cell3Result.result, outputs: [] },
          { id: 'ml-4', instructions: { text: 'Evaluate model', parameters: [] }, code: cell4Result.result, outputs: [] },
          { id: 'ml-5', instructions: { text: 'Confusion matrix', parameters: [] }, code: cell5Result.result, outputs: [] },
        ],
      };

      const saveResult = await appPage.evaluate(
        async ({ projectId, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, 'ml-pipeline.yaml', notebook);
        },
        { projectId: project.id, notebook }
      );
      expect(saveResult.success).toBe(true);

      // Setup tabs
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'ml-tab', filePath: 'ml-pipeline.yaml', scrollPosition: 0, activeCellId: 'ml-1' });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'exp-tab', filePath: 'experiments.yaml', scrollPosition: 0, activeCellId: null });
        },
        { projectId: project.id }
      );

      // Simulate working on experiments, then coming back to ML pipeline
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'exp-tab');
        },
        { projectId: project.id }
      );

      // Add a cell to experiments notebook
      const expCell = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('exp-1', 'toCode', {
          newContent: 'Try different hyperparameters for the model',
          existingCounterpart: '',
        });
      });
      expect(expCell.success).toBe(true);

      // Switch back to ML pipeline
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.setActiveTab(projectId, 'ml-tab');
        },
        { projectId: project.id }
      );

      // Verify ML pipeline content is intact
      const readResult = await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, 'ml-pipeline.yaml');
        },
        { projectId: project.id }
      );
      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('ml-1');
      expect(readResult.content).toContain('ml-5');
      expect(readResult.content).toContain('RandomForest');
    });
  });

  /**
   * Cross-Scenario Test: Switch between all 4 workflows
   */
  test.describe('Cross-Scenario Navigation', () => {
    test('should maintain state when switching between multiple data science notebooks', async ({
      appPage,
      createTestProject,
      createTestNotebook,
      openTestProject,
    }) => {
      const project = await createTestProject('Multi-Workflow Project');

      // Create all notebooks
      await createTestNotebook(project.id, 'cleaning');
      await createTestNotebook(project.id, 'analysis');
      await createTestNotebook(project.id, 'visualization');
      await createTestNotebook(project.id, 'modeling');
      await openTestProject(project.id);

      // Sync one cell for each notebook type
      const cleaningCell = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('clean-1', 'toCode', {
          newContent: 'Remove duplicate rows from the DataFrame',
          existingCounterpart: '',
        });
      });
      expect(cleaningCell.success).toBe(true);

      const analysisCell = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('analysis-1', 'toCode', {
          newContent: 'Calculate the median value for each numeric column',
          existingCounterpart: '',
        });
      });
      expect(analysisCell.success).toBe(true);

      const vizCell = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('viz-1', 'toCode', {
          newContent: 'Create a pie chart showing category distribution',
          existingCounterpart: '',
        });
      });
      expect(vizCell.success).toBe(true);

      const modelCell = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('model-1', 'toCode', {
          newContent: 'Train a logistic regression model',
          existingCounterpart: '',
        });
      });
      expect(modelCell.success).toBe(true);

      // Save all notebooks
      await appPage.evaluate(
        async ({ projectId, cleaningCode, analysisCode, vizCode, modelCode }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.project.saveNotebook(projectId, 'cleaning.yaml', {
            cells: [{ id: 'clean-1', instructions: { text: 'Remove duplicates', parameters: [] }, code: cleaningCode, outputs: [] }],
          });
          // @ts-expect-error - promptbook API
          await window.promptbook.project.saveNotebook(projectId, 'analysis.yaml', {
            cells: [{ id: 'analysis-1', instructions: { text: 'Calculate medians', parameters: [] }, code: analysisCode, outputs: [] }],
          });
          // @ts-expect-error - promptbook API
          await window.promptbook.project.saveNotebook(projectId, 'visualization.yaml', {
            cells: [{ id: 'viz-1', instructions: { text: 'Pie chart', parameters: [] }, code: vizCode, outputs: [] }],
          });
          // @ts-expect-error - promptbook API
          await window.promptbook.project.saveNotebook(projectId, 'modeling.yaml', {
            cells: [{ id: 'model-1', instructions: { text: 'Logistic regression', parameters: [] }, code: modelCode, outputs: [] }],
          });
        },
        {
          projectId: project.id,
          cleaningCode: cleaningCell.result,
          analysisCode: analysisCell.result,
          vizCode: vizCell.result,
          modelCode: modelCell.result,
        }
      );

      // Setup all tabs
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-clean', filePath: 'cleaning.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-analysis', filePath: 'analysis.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-viz', filePath: 'visualization.yaml', scrollPosition: 0, activeCellId: null });
          // @ts-expect-error - promptbook API
          await window.promptbook.session.addTab(projectId, { id: 'tab-model', filePath: 'modeling.yaml', scrollPosition: 0, activeCellId: null });
        },
        { projectId: project.id }
      );

      // Rapidly switch between all tabs
      const tabIds = ['tab-clean', 'tab-analysis', 'tab-viz', 'tab-model'];
      for (let round = 0; round < 3; round++) {
        for (const tabId of tabIds) {
          await appPage.evaluate(
            async ({ projectId, tabId }) => {
              // @ts-expect-error - promptbook API
              return window.promptbook.session.setActiveTab(projectId, tabId);
            },
            { projectId: project.id, tabId }
          );
        }
      }

      // Verify all notebooks still have their content
      const notebooks = ['cleaning.yaml', 'analysis.yaml', 'visualization.yaml', 'modeling.yaml'];
      const expectedContent = ['duplicate', 'median', 'pie', 'logistic'];

      for (let i = 0; i < notebooks.length; i++) {
        const result = await appPage.evaluate(
          async ({ projectId, filename }) => {
            // @ts-expect-error - promptbook API
            return window.promptbook.project.readFile(projectId, filename);
          },
          { projectId: project.id, filename: notebooks[i] }
        );
        expect(result.success).toBe(true);
        expect(result.content.toLowerCase()).toContain(expectedContent[i]);
      }
    });
  });
});
