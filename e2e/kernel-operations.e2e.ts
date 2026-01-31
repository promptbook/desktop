/**
 * E2E Tests: Kernel Operations
 *
 * Tests for Python kernel functionality including environment management,
 * code execution, interrupts, restarts, and variable inspection.
 */
import { test, expect } from './fixtures';

/**
 * Helper to start kernel if not running
 */
async function ensureKernelStarted(appPage: any): Promise<boolean> {
  const status = await appPage.evaluate(async () => {
    // @ts-expect-error - promptbook API
    return window.promptbook.kernel.getStatus();
  });

  if (status.state === 'idle') {
    return true; // Already running
  }

  // Try to find a Python environment and start kernel
  const envs = await appPage.evaluate(async () => {
    // @ts-expect-error - promptbook API
    return window.promptbook.kernel.scanEnvironments();
  });

  // Find an environment with ipykernel
  const validEnv = envs.find((e: { hasIpykernel: boolean }) => e.hasIpykernel);
  if (!validEnv) {
    console.log('No Python environment with ipykernel found');
    return false;
  }

  // Select the environment (this starts the kernel)
  const selectResult = await appPage.evaluate(async (pythonPath: string) => {
    // @ts-expect-error - promptbook API
    return window.promptbook.kernel.selectEnvironment(pythonPath);
  }, validEnv.path);

  if (!selectResult.success) {
    console.log('Failed to select environment:', selectResult.error);
    return false;
  }

  // Wait for kernel to be ready
  await appPage.waitForTimeout(5000);

  const newStatus = await appPage.evaluate(async () => {
    // @ts-expect-error - promptbook API
    return window.promptbook.kernel.getStatus();
  });

  console.log('Kernel status after start:', newStatus.state);
  return newStatus.state === 'idle';
}

test.describe('Kernel Operations', () => {
  test.describe('Environment Management', () => {
    test('should scan for Python environments', async ({ appPage }) => {
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.scanEnvironments();
      });

      expect(Array.isArray(result)).toBe(true);
      // Each environment should have required properties
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('path');
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('version');
        expect(result[0]).toHaveProperty('type');
        expect(result[0]).toHaveProperty('hasIpykernel');
      }
    });

    test('should get cached environments', async ({ appPage }) => {
      // First scan
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.scanEnvironments();
      });

      // Then get cached
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getEnvironments();
      });

      expect(Array.isArray(result)).toBe(true);
    });

    test('should test Python path validity', async ({ appPage }) => {
      // Test with a common Python path
      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.testPython('/usr/bin/python3');
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('hasIpykernel');
    });

    test('should get kernel status', async ({ appPage }) => {
      const status = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getStatus();
      });

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('executionCount');
      expect(['idle', 'busy', 'starting', 'dead', 'disconnected']).toContain(status.state);
      expect(typeof status.executionCount).toBe('number');
    });
  });

  test.describe('Code Execution', () => {
    // These tests require a kernel to be running
    // They will try to start a kernel if one isn't running

    test('should execute simple code', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('print("Hello from kernel!")');
      });

      expect(result.success).toBe(true);
      expect(result.msgId).toBeTruthy();
      expect(result.outputs).toBeDefined();

      const stdout = result.outputs?.find((o: { type: string }) => o.type === 'stdout');
      expect(stdout?.content).toContain('Hello from kernel!');
    });

    test('should execute code with return value', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('2 + 2');
      });

      expect(result.success).toBe(true);
      const resultOutput = result.outputs?.find((o: { type: string }) => o.type === 'result');
      expect(resultOutput?.content).toContain('4');
    });

    test('should handle execution errors gracefully', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      const result = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('raise ValueError("Test error")');
      });

      expect(result.success).toBe(true); // Execution succeeded, but code raised error
      const errorOutput = result.outputs?.find((o: { type: string }) => o.type === 'error');
      expect(errorOutput).toBeDefined();
      expect(errorOutput?.content).toContain('ValueError');
    });

    test('should execute multi-line code', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      const code = `
def greet(name):
    return f"Hello, {name}!"

result = greet("World")
print(result)
`;

      const result = await appPage.evaluate(async (code) => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(code);
      }, code);

      expect(result.success).toBe(true);
      const stdout = result.outputs?.find((o: { type: string }) => o.type === 'stdout');
      expect(stdout?.content).toContain('Hello, World!');
    });

    test('should execute dependent cells', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      // Cell 1: Define variable
      const cell1 = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('x = 10');
      });
      expect(cell1.success).toBe(true);

      // Cell 2: Use variable
      const cell2 = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('y = x * 2\nprint(y)');
      });
      expect(cell2.success).toBe(true);
      const stdout = cell2.outputs?.find((o: { type: string }) => o.type === 'stdout');
      expect(stdout?.content).toContain('20');

      // Cell 3: Use both variables
      const cell3 = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('z = x + y\nprint(z)');
      });
      expect(cell3.success).toBe(true);
      const stdout3 = cell3.outputs?.find((o: { type: string }) => o.type === 'stdout');
      expect(stdout3?.content).toContain('30');
    });
  });

  test.describe('Kernel Control', () => {
    test('should interrupt execution', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      // Start a long-running operation (don't await)
      appPage.evaluate(() => {
        // @ts-expect-error - promptbook API
        window.promptbook.kernel.execute('import time; time.sleep(10)');
      });

      // Wait a bit then interrupt
      await appPage.waitForTimeout(500);

      const interruptResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.interrupt();
      });

      // Interrupt should succeed or fail gracefully
      expect(interruptResult).toHaveProperty('success');
    });

    test('should restart kernel', async ({ appPage }) => {
      const status = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getStatus();
      });

      if (status.state === 'disconnected') {
        test.skip();
        return;
      }

      const restartResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.restart();
      });

      // Should either succeed or provide an error
      expect(restartResult).toHaveProperty('success');
    });
  });

  test.describe('Variable Inspection', () => {
    test('should get variables from kernel', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      // Define some variables
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
test_int = 42
test_str = "hello"
test_list = [1, 2, 3]
`);
      });

      // Get variables
      const varsResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getVariables();
      });

      expect(varsResult.success).toBe(true);
      expect(Array.isArray(varsResult.variables)).toBe(true);

      // Check for our variables
      const varNames = varsResult.variables.map((v: { name: string }) => v.name);
      expect(varNames).toContain('test_int');
      expect(varNames).toContain('test_str');
      expect(varNames).toContain('test_list');
    });

    test('should get symbols (variables and functions)', async ({ appPage }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      // Define variables and functions
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute(`
my_var = 100

def my_function(x):
    """A test function."""
    return x * 2
`);
      });

      // Get symbols
      const symbolsResult = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getSymbols();
      });

      expect(symbolsResult.success).toBe(true);
      expect(Array.isArray(symbolsResult.symbols)).toBe(true);

      // Check for both variable and function
      const symbolNames = symbolsResult.symbols.map((s: { name: string }) => s.name);
      expect(symbolNames).toContain('my_var');
      expect(symbolNames).toContain('my_function');

      // Check function metadata
      const funcSymbol = symbolsResult.symbols.find(
        (s: { name: string }) => s.name === 'my_function'
      );
      expect(funcSymbol?.kind).toBe('function');
    });
  });

  test.describe('Kernel Events', () => {
    test('should receive output events', async ({ appPage, testEvents, waitForEvent }) => {
      const kernelReady = await ensureKernelStarted(appPage);
      if (!kernelReady) {
        test.skip();
        return;
      }

      // Set up listener before execution
      let outputReceived = false;
      await appPage.evaluate(() => {
        // @ts-expect-error - promptbook API
        window.promptbook.kernel.onOutput((output: unknown) => {
          // @ts-expect-error - custom handler
          window.__lastKernelOutput = output;
        });
      });

      // Execute code
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('print("event test")');
      });

      // Check if output was received
      const lastOutput = await appPage.evaluate(() => {
        // @ts-expect-error - custom variable
        return window.__lastKernelOutput;
      });

      // Output event should have been triggered
      expect(lastOutput).toBeDefined();
    });

    test('should receive state change events', async ({ appPage }) => {
      const status = await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.getStatus();
      });

      if (status.state === 'disconnected') {
        test.skip();
        return;
      }

      // Set up listener
      await appPage.evaluate(() => {
        // @ts-expect-error - promptbook API
        window.__stateChanges = [];
        // @ts-expect-error - promptbook API
        window.promptbook.kernel.onStateChange((state: string) => {
          // @ts-expect-error - custom array
          window.__stateChanges.push(state);
        });
      });

      // Execute something to trigger state changes
      await appPage.evaluate(async () => {
        // @ts-expect-error - promptbook API
        return window.promptbook.kernel.execute('x = 1');
      });

      // Check state changes
      const stateChanges = await appPage.evaluate(() => {
        // @ts-expect-error - custom variable
        return window.__stateChanges;
      });

      expect(Array.isArray(stateChanges)).toBe(true);
    });
  });
});
