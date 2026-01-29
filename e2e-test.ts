import { _electron as electron, ElectronApplication, Page } from 'playwright';

async function runTest() {
  let electronApp: ElectronApplication | null = null;

  try {
    console.log('Launching Electron app...');

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        // Pass Anthropic API key for AI sync (reads from env)
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    });

    // Capture main process stdout/stderr
    electronApp.process().stdout?.on('data', (data) => {
      console.log('[MAIN]', data.toString().trim());
    });
    electronApp.process().stderr?.on('data', (data) => {
      console.log('[MAIN-ERR]', data.toString().trim());
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const windows = electronApp.windows();
    let window: Page | null = null;
    for (const w of windows) {
      const title = await w.title();
      if (title !== 'DevTools' && !title.includes('Developer Tools')) {
        window = w;
        break;
      }
    }

    if (!window) {
      console.error('Could not find main window');
      return;
    }

    console.log('Using window:', await window.title());

    // Capture browser console
    window.on('console', (msg) => {
      console.log('[BROWSER]', msg.type().toUpperCase(), msg.text());
    });

    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    await window.screenshot({ path: 'test-screenshots/01-initial.png' });

    // Step 1: Select kernel
    console.log('\n=== Step 1: Select Kernel ===');
    const kernelStatus = window.locator('.kernel-status__button');
    await kernelStatus.click();
    await window.waitForTimeout(1000);

    // Check if picker opened
    const pickerVisible = await window.locator('.environment-picker').isVisible();
    console.log('Environment picker visible:', pickerVisible);
    await window.screenshot({ path: 'test-screenshots/02-picker.png' });

    const envItem = window.locator('.environment-picker__item').first();
    const envCount = await envItem.count();
    console.log('Environment items found:', envCount);

    if (envCount > 0) {
      // Get the environment name before clicking
      const envName = await envItem.locator('.environment-picker__name').textContent();
      console.log('Clicking on environment:', envName);

      await envItem.click();
      console.log('Clicked environment');

      // Wait and check for errors
      await window.waitForTimeout(2000);

      // Check for error in picker (installError)
      const pickerError = window.locator('.environment-picker__create-error');
      if (await pickerError.count() > 0 && await pickerError.isVisible()) {
        const errorText = await pickerError.textContent();
        console.log('Picker error:', errorText);
      }

      // Check for global error toast
      const errorToast = window.locator('.error-toast');
      if (await errorToast.count() > 0 && await errorToast.isVisible()) {
        const errorText = await errorToast.textContent();
        console.log('Error toast:', errorText);
      }

      // Wait longer for kernel to connect
      console.log('Waiting for kernel...');
      for (let i = 0; i < 15; i++) {
        await window.waitForTimeout(1000);
        const statusText = await window.locator('.kernel-status__button').textContent();
        console.log(`  Status: ${statusText}`);
        if (statusText?.includes('Connected') || statusText?.includes('idle')) {
          console.log('Kernel connected!');
          break;
        }
      }
    }
    await window.screenshot({ path: 'test-screenshots/03-after-select.png' });

    // Step 2: Write code directly
    console.log('\n=== Step 2: Write Code Directly ===');
    const codeTab = window.locator('button[role="tab"]:has-text("Code")').first();
    await codeTab.click();
    await window.waitForTimeout(500);

    // Click on the code editor and type code
    const codeEditor = window.locator('.code-editor textarea, .monaco-editor');
    if (await codeEditor.count() > 0) {
      await codeEditor.first().click();
      await window.waitForTimeout(200);
      await window.keyboard.press('Meta+a');
      await window.keyboard.type('print(3 + 3)');
      console.log('Typed code: print(3 + 3)');
    } else {
      // Try to find any textarea in the code area
      const textarea = window.locator('textarea').first();
      await textarea.click();
      await window.keyboard.press('Meta+a');
      await window.keyboard.type('print(3 + 3)');
      console.log('Typed code: print(3 + 3)');
    }
    await window.waitForTimeout(500);
    await window.screenshot({ path: 'test-screenshots/05-code-entered.png' });

    // Step 3: Run
    console.log('\n=== Step 3: Run Code ===');
    const runBtn = window.locator('button:has-text("Run")').first();
    await runBtn.click();
    console.log('Clicked Run');
    await window.waitForTimeout(5000);
    await window.screenshot({ path: 'test-screenshots/04-after-run.png' });

    // Check output
    const outputArea = window.locator('.cell-output').first();
    if (await outputArea.count() > 0) {
      const outputText = await outputArea.textContent();
      console.log('\n=== OUTPUT ===');
      console.log(outputText);
      if (outputText?.includes('6')) {
        console.log('SUCCESS: Output contains expected result "6"');
      }
    } else {
      console.log('WARNING: No output area found');
    }

    await window.screenshot({ path: 'test-screenshots/05-final.png' });
    console.log('\n=== Test completed! ===');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
  }
}

import { mkdirSync } from 'fs';
try { mkdirSync('test-screenshots', { recursive: true }); } catch {}

runTest();
