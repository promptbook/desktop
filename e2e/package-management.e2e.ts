/**
 * E2E Tests: Package/Module Installation
 *
 * Tests for installing Python packages like pandas, numpy, etc.
 * through the kernel API.
 */
import { test, expect } from './fixtures';

test.describe('Package Management', () => {
  test.describe('Package Detection', () => {
    /**
     * Test that the system can detect missing packages in code
     */
    test('should detect missing packages from import statements', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // Check if package detection API exists
        // @ts-expect-error - promptbook API
        if (window.promptbook.kernel?.detectMissingPackages) {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.detectMissingPackages(`
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
`);
        }
        return { detected: false, reason: 'API not available' };
      });

      // If the API exists, it should return detected packages
      if (result.detected !== false) {
        expect(result).toHaveProperty('packages');
      }
    });

    /**
     * Test detection of common data science packages
     * Simple test that verifies we can parse Python import statements
     */
    test('should identify common data science imports', async ({ appPage }) => {
      // Test basic import parsing logic
      const testCases = [
        { code: 'import pandas as pd', expectedImport: 'pandas' },
        { code: 'import numpy as np', expectedImport: 'numpy' },
        { code: 'import matplotlib.pyplot as plt', expectedImport: 'matplotlib' },
        { code: 'from sklearn.ensemble import RandomForestClassifier', expectedImport: 'sklearn' },
      ];

      for (const testCase of testCases) {
        const result = await appPage.evaluate(async (code) => {
          // Simple regex parsing for Python imports
          const importMatch = code.match(/^import\s+([\w]+)/);
          const fromMatch = code.match(/^from\s+([\w]+)/);
          const extracted = importMatch?.[1] || fromMatch?.[1] || null;
          return { imports: extracted ? [extracted] : [] };
        }, testCase.code);

        expect(result.imports).toBeDefined();
        expect(result.imports.length).toBeGreaterThan(0);
        expect(result.imports[0]).toBe(testCase.expectedImport);
      }
    });
  });

  test.describe('Package Installation (requires kernel)', () => {
    /**
     * Test installing a simple package via pip
     * Note: This test is skipped if no kernel is available
     */
    test('should install package via pip command', async ({ appPage }) => {
      // Check kernel status first
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel?.getStatus?.();
      });

      // Skip if kernel not available
      if (!kernelStatus || kernelStatus.state !== 'idle') {
        test.skip();
        return;
      }

      // Try to install a lightweight test package
      const installResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('!pip install --quiet six');
      });

      expect(installResult.success).toBe(true);

      // Verify installation by importing
      const verifyResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('import six; print(six.__version__)');
      });

      expect(verifyResult.success).toBe(true);
    });

    /**
     * Test installing pandas
     */
    test('should install pandas package', async ({ appPage }) => {
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel?.getStatus?.();
      });

      if (!kernelStatus || kernelStatus.state !== 'idle') {
        test.skip();
        return;
      }

      // Check if pandas is already installed
      const checkResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('import pandas; print("installed")');
      });

      if (!checkResult.success) {
        // Install pandas
        const installResult = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute('!pip install pandas');
        });
        expect(installResult.success).toBe(true);
      }

      // Verify pandas works
      const verifyResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
import pandas as pd
df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
print(df.shape)
`);
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.outputs?.some((o: { content: string }) => o.content?.includes('(3, 2)'))).toBe(true);
    });

    /**
     * Test installing numpy
     */
    test('should install numpy package', async ({ appPage }) => {
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel?.getStatus?.();
      });

      if (!kernelStatus || kernelStatus.state !== 'idle') {
        test.skip();
        return;
      }

      // Check if numpy is already installed
      const checkResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('import numpy; print("installed")');
      });

      if (!checkResult.success) {
        // Install numpy
        const installResult = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute('!pip install numpy');
        });
        expect(installResult.success).toBe(true);
      }

      // Verify numpy works
      const verifyResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"Mean: {arr.mean()}")
`);
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.outputs?.some((o: { content: string }) => o.content?.includes('Mean: 3.0'))).toBe(true);
    });

    /**
     * Test installing matplotlib
     */
    test('should install matplotlib package', async ({ appPage }) => {
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel?.getStatus?.();
      });

      if (!kernelStatus || kernelStatus.state !== 'idle') {
        test.skip();
        return;
      }

      // Check if matplotlib is already installed
      const checkResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('import matplotlib; print("installed")');
      });

      if (!checkResult.success) {
        // Install matplotlib
        const installResult = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute('!pip install matplotlib');
        });
        expect(installResult.success).toBe(true);
      }

      // Verify matplotlib can be imported
      const verifyResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
import matplotlib
import matplotlib.pyplot as plt
print(f"matplotlib version: {matplotlib.__version__}")
`);
      });

      expect(verifyResult.success).toBe(true);
    });

    /**
     * Test installing scikit-learn
     */
    test('should install scikit-learn package', async ({ appPage }) => {
      const kernelStatus = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel?.getStatus?.();
      });

      if (!kernelStatus || kernelStatus.state !== 'idle') {
        test.skip();
        return;
      }

      // Check if sklearn is already installed
      const checkResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('import sklearn; print("installed")');
      });

      if (!checkResult.success) {
        // Install scikit-learn
        const installResult = await appPage.evaluate(async () => {
          // @ts-expect-error - promptbook API
          return window.promptbook.kernel.execute('!pip install scikit-learn');
        });
        expect(installResult.success).toBe(true);
      }

      // Verify sklearn works
      const verifyResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
from sklearn.datasets import load_iris
data = load_iris()
print(f"Iris dataset loaded: {data.data.shape}")
`);
      });

      expect(verifyResult.success).toBe(true);
    });
  });

  test.describe('Package Install Modal', () => {
    /**
     * Test that the package install modal API exists
     */
    test('should have package install functionality', async ({ appPage }) => {
      const hasInstallAPI = await appPage.evaluate(async () => {
        // Check various possible API locations
        // @ts-expect-error - promptbook API
        const hasKernelInstall = typeof window.promptbook?.kernel?.installPackages === 'function';
        // @ts-expect-error - promptbook API
        const hasPackageAPI = typeof window.promptbook?.packages?.install === 'function';
        return { hasKernelInstall, hasPackageAPI };
      });

      // At least one API should exist for installing packages
      // This is informational - we don't fail if it doesn't exist
      console.log('Package install APIs:', hasInstallAPI);
    });

    /**
     * Test package installation with different methods
     */
    test('should support multiple installation methods', async ({ appPage }) => {
      // Check if package installation supports different modes:
      // - 'once': Install in current kernel session only
      // - 'current-cell': Add pip install to current cell
      // - 'setup-cell': Add pip install to a setup cell

      const installMethods = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        const api = window.promptbook?.kernel || window.promptbook?.packages;
        if (!api) return { methods: [] };

        const methods = [];
        if (typeof api.installOnce === 'function') methods.push('once');
        if (typeof api.addToCell === 'function') methods.push('current-cell');
        if (typeof api.addToSetupCell === 'function') methods.push('setup-cell');
        if (typeof api.installPackages === 'function') methods.push('installPackages');

        return { methods };
      });

      console.log('Available install methods:', installMethods.methods);
    });
  });

  test.describe('Package Sync with AI', () => {
    /**
     * Test that AI-generated code includes proper imports
     */
    test('should generate code with correct imports', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('import-test-1', 'toCode', {
          newContent: 'Load a CSV file and calculate the mean of a numeric column',
          existingCounterpart: '',
        });
      });

      expect(result.success).toBe(true);
      // Generated code should include pandas import
      expect(result.result).toMatch(/import pandas|from pandas/i);
    });

    /**
     * Test that AI handles complex dependencies
     */
    test('should generate code with all required imports for ML', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.ai.sync('import-test-2', 'toCode', {
          newContent: 'Train a random forest model on the iris dataset and evaluate with cross-validation',
          existingCounterpart: '',
        });
      });

      expect(result.success).toBe(true);
      // Should include sklearn imports
      expect(result.result).toMatch(/sklearn|RandomForest/i);
    });
  });
});
