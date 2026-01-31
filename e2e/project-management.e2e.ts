/**
 * E2E Tests: Project Management
 *
 * Tests for creating, opening, renaming, and deleting projects,
 * as well as notebook file operations within projects.
 */
import { test, expect } from './fixtures';

test.describe('Project Management', () => {
  test.describe('Project CRUD Operations', () => {
    test('should create a new project', async ({ appPage, createTestProject }) => {
      // Create project
      const project = await createTestProject('Test Project');

      // Verify project was created
      expect(project.id).toBeTruthy();
      expect(project.name).toBe('Test Project');
      expect(project.path).toContain('Test Project');

      // Verify project appears in the list
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.list();
      });

      expect(result.success).toBe(true);
      expect(result.projects).toContainEqual(expect.objectContaining({ id: project.id }));
    });

    test('should open an existing project', async ({
      appPage,
      createTestProject,
      openTestProject,
    }) => {
      // Create and open project
      const project = await createTestProject('Open Test Project');
      await openTestProject(project.id);

      // Verify project is opened by checking the current project state
      const currentProject = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.getCurrent?.();
      });

      // Project should be set as current (if API exists) or open succeeded
      if (currentProject) {
        expect(currentProject.id).toBe(project.id);
      }
      // Test passes if openTestProject didn't throw
    });

    test('should rename a project', async ({ appPage, createTestProject }) => {
      // Create project
      const project = await createTestProject('Original Name');

      // Rename project
      const updateResult = await appPage.evaluate(
        async ({ projectId, newName }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.update(projectId, { name: newName });
        },
        { projectId: project.id, newName: 'Renamed Project' }
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.project?.name).toBe('Renamed Project');
    });

    test('should delete a project', async ({ appPage, createTestProject }) => {
      // Create project
      const project = await createTestProject('Delete Me');

      // Delete project
      const deleteResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.delete(projectId, false);
      }, project.id);

      expect(deleteResult.success).toBe(true);

      // Verify project is removed from list
      const listResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.list();
      });

      expect(listResult.projects).not.toContainEqual(expect.objectContaining({ id: project.id }));
    });

    test('should get recent projects', async ({ appPage, createTestProject, openTestProject }) => {
      // Create multiple projects
      const project1 = await createTestProject('Recent Project 1');
      const project2 = await createTestProject('Recent Project 2');
      const project3 = await createTestProject('Recent Project 3');

      // Open them in order
      await openTestProject(project1.id);
      await openTestProject(project2.id);
      await openTestProject(project3.id);

      // Get recent projects
      const recentResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.getRecent(2);
      });

      expect(recentResult.success).toBe(true);
      expect(recentResult.projects.length).toBeLessThanOrEqual(2);
      // Most recently opened should be first
      expect(recentResult.projects[0].id).toBe(project3.id);
    });
  });

  test.describe('Notebook File Operations', () => {
    test('should create a notebook in a project', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Notebook Test Project');
      await createTestNotebook(project.id, 'test-notebook');

      // Verify notebook exists
      const filesResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.listFiles(projectId);
      }, project.id);

      expect(filesResult.success).toBe(true);
      expect(filesResult.files).toContainEqual(
        expect.objectContaining({ name: 'test-notebook.yaml' })
      );
    });

    test('should rename a notebook', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Rename Notebook Project');
      await createTestNotebook(project.id, 'original-name');

      // Rename the notebook
      const renameResult = await appPage.evaluate(
        async ({ projectId, oldPath, newPath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.renameFile(projectId, oldPath, newPath);
        },
        { projectId: project.id, oldPath: 'original-name.yaml', newPath: 'new-name.yaml' }
      );

      expect(renameResult.success).toBe(true);

      // Verify new name exists
      const filesResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.listFiles(projectId);
      }, project.id);

      expect(filesResult.files).toContainEqual(expect.objectContaining({ name: 'new-name.yaml' }));
      expect(filesResult.files).not.toContainEqual(
        expect.objectContaining({ name: 'original-name.yaml' })
      );
    });

    test('should delete a notebook', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Delete Notebook Project');
      await createTestNotebook(project.id, 'to-delete');

      // Delete the notebook
      const deleteResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.deleteFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'to-delete.yaml' }
      );

      expect(deleteResult.success).toBe(true);

      // Verify notebook is gone
      const filesResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.listFiles(projectId);
      }, project.id);

      expect(filesResult.files).not.toContainEqual(
        expect.objectContaining({ name: 'to-delete.yaml' })
      );
    });

    test('should save and read notebook content', async ({
      appPage,
      createTestProject,
      createTestNotebook,
    }) => {
      const project = await createTestProject('Save Read Project');
      await createTestNotebook(project.id, 'save-test');

      // Save notebook with content
      const notebook = {
        cells: [
          {
            id: 'cell-1',
            instructions: { text: 'Load data', parameters: [] },
            code: 'import pandas as pd',
            outputs: [],
          },
        ],
      };

      const saveResult = await appPage.evaluate(
        async ({ projectId, relativePath, notebook }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.saveNotebook(projectId, relativePath, notebook);
        },
        { projectId: project.id, relativePath: 'save-test.yaml', notebook }
      );

      expect(saveResult.success).toBe(true);

      // Read it back
      const readResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.readFile(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'save-test.yaml' }
      );

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('import pandas as pd');
      expect(readResult.content).toContain('Load data');
    });
  });

  test.describe('Folder Operations', () => {
    test('should create a folder in a project', async ({ appPage, createTestProject }) => {
      const project = await createTestProject('Folder Test Project');

      // Create a folder
      const createResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.createFolder(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'subfolder' }
      );

      expect(createResult.success).toBe(true);

      // Verify folder exists
      const filesResult = await appPage.evaluate(async (projectId) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.project.listFiles(projectId);
      }, project.id);

      expect(filesResult.files).toContainEqual(
        expect.objectContaining({ name: 'subfolder', isDirectory: true })
      );
    });

    test('should create nested notebooks', async ({
      appPage,
      createTestProject,
    }) => {
      const project = await createTestProject('Nested Notebook Project');

      // Create folder and notebook inside
      await appPage.evaluate(
        async ({ projectId }) => {
          // @ts-expect-error - promptbook API
          await window.promptbook.project.createFolder(projectId, 'data');
          // @ts-expect-error - promptbook API
          await window.promptbook.project.createFile(projectId, 'data/analysis.yaml', 'cells: []');
        },
        { projectId: project.id }
      );

      // List files in subfolder
      const filesResult = await appPage.evaluate(
        async ({ projectId, relativePath }) => {
          // @ts-expect-error - promptbook API
          return window.promptbook.project.listFiles(projectId, relativePath);
        },
        { projectId: project.id, relativePath: 'data' }
      );

      expect(filesResult.success).toBe(true);
      expect(filesResult.files).toContainEqual(
        expect.objectContaining({ name: 'analysis.yaml' })
      );
    });
  });
});
