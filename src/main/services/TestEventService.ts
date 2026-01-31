import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import type { KernelOutput, KernelState } from '@promptbook/core';
import type { SyncDirection, AiSyncContext } from '@promptbook/core/sync';
import type { AiSyncResult } from '@promptbook/core';

/**
 * Event types emitted by TestEventService for test monitoring
 */
export interface TestEvents {
  // LLM Events
  'llm:request': {
    timestamp: number;
    cellId: string;
    direction: SyncDirection;
    context: AiSyncContext;
  };
  'llm:response': {
    timestamp: number;
    cellId: string;
    direction: SyncDirection;
    result: AiSyncResult;
    durationMs: number;
  };
  'llm:error': {
    timestamp: number;
    cellId: string;
    direction: SyncDirection;
    error: string;
  };
  'llm:progress': {
    timestamp: number;
    cellId: string;
    stage: 'connecting' | 'sending' | 'streaming' | 'processing';
    message?: string;
    partialResult?: string;
  };
  'llm:stream:chunk': {
    timestamp: number;
    cellId: string;
    chunk: string;
    totalLength: number;
  };

  // Agent Events (for Claude Agent SDK)
  'agent:start': {
    timestamp: number;
    cellId: string;
    direction: SyncDirection;
    provider: string;
  };
  'agent:thinking': {
    timestamp: number;
    cellId: string;
    message: string;
  };
  'agent:tool_use': {
    timestamp: number;
    cellId: string;
    toolName: string;
    input: unknown;
  };
  'agent:tool_result': {
    timestamp: number;
    cellId: string;
    toolName: string;
    result: unknown;
  };
  'agent:complete': {
    timestamp: number;
    cellId: string;
    result: string;
    durationMs: number;
  };
  'agent:error': {
    timestamp: number;
    cellId: string;
    error: string;
    stack?: string;
  };

  // Python/Kernel Events
  'kernel:execute:start': {
    timestamp: number;
    code: string;
    msgId: string;
  };
  'kernel:execute:complete': {
    timestamp: number;
    msgId: string;
    outputs: KernelOutput[];
    durationMs: number;
  };
  'kernel:output': {
    timestamp: number;
    output: KernelOutput;
    msgId: string;
  };
  'kernel:state': {
    timestamp: number;
    state: KernelState;
  };
  'kernel:error': {
    timestamp: number;
    error: string;
  };

  // Project Events
  'project:created': {
    timestamp: number;
    projectId: string;
    name: string;
  };
  'project:opened': {
    timestamp: number;
    projectId: string;
  };
  'project:deleted': {
    timestamp: number;
    projectId: string;
  };

  // Notebook Events
  'notebook:created': {
    timestamp: number;
    projectId: string;
    path: string;
  };
  'notebook:opened': {
    timestamp: number;
    projectId: string;
    path: string;
  };
  'notebook:saved': {
    timestamp: number;
    projectId: string;
    path: string;
  };
  'notebook:renamed': {
    timestamp: number;
    projectId: string;
    oldPath: string;
    newPath: string;
  };

  // Tab Events
  'tab:added': {
    timestamp: number;
    projectId: string;
    tabId: string;
    filePath: string;
  };
  'tab:removed': {
    timestamp: number;
    projectId: string;
    tabId: string;
  };
  'tab:activated': {
    timestamp: number;
    projectId: string;
    tabId: string;
  };
}

type TestEventName = keyof TestEvents;
type TestEventCallback<T extends TestEventName> = (data: TestEvents[T]) => void;

/**
 * TestEventService provides a centralized event bus for test monitoring.
 * It captures and exposes all significant application events to enable
 * comprehensive E2E testing with proper assertions.
 *
 * IMPORTANT: This service should only be active in test/development mode.
 */
export class TestEventService extends EventEmitter {
  private static instance: TestEventService | null = null;
  private mainWindow: (() => BrowserWindow | null) | null = null;
  private eventHistory: Array<{ event: string; data: unknown; timestamp: number }> = [];
  private maxHistorySize = 1000;
  private isEnabled = false;

  private constructor() {
    super();
    // Enable in test or development environment
    this.isEnabled = process.env.NODE_ENV !== 'production' ||
                     process.env.PROMPTBOOK_TEST_MODE === 'true';
  }

  static getInstance(): TestEventService {
    if (!TestEventService.instance) {
      TestEventService.instance = new TestEventService();
    }
    return TestEventService.instance;
  }

  /**
   * Reset the singleton (useful for tests)
   */
  static reset(): void {
    if (TestEventService.instance) {
      TestEventService.instance.removeAllListeners();
      TestEventService.instance.clearHistory();
    }
    TestEventService.instance = null;
  }

  /**
   * Enable test event tracking
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable test event tracking
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Check if test events are enabled
   */
  isActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Set the main window for IPC event forwarding
   */
  setMainWindow(getWindow: () => BrowserWindow | null): void {
    this.mainWindow = getWindow;
  }

  /**
   * Emit a test event with timestamp
   */
  emitTestEvent<T extends TestEventName>(event: T, data: Omit<TestEvents[T], 'timestamp'>): void {
    if (!this.isEnabled) return;

    const timestamp = Date.now();
    const eventData = { ...data, timestamp } as TestEvents[T];

    // Store in history
    this.eventHistory.push({ event, data: eventData, timestamp });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit locally
    this.emit(event, eventData);

    // Forward to renderer for test assertions
    const window = this.mainWindow?.();
    if (window && !window.isDestroyed()) {
      window.webContents.send('test:event', event, eventData);
    }
  }

  /**
   * Subscribe to a specific test event
   */
  onTestEvent<T extends TestEventName>(event: T, callback: TestEventCallback<T>): () => void {
    this.on(event, callback);
    return () => this.off(event, callback);
  }

  /**
   * Get event history, optionally filtered by event type
   */
  getHistory(eventFilter?: TestEventName): Array<{ event: string; data: unknown; timestamp: number }> {
    if (eventFilter) {
      return this.eventHistory.filter(e => e.event === eventFilter);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Wait for a specific event to occur
   */
  waitForEvent<T extends TestEventName>(
    event: T,
    timeout = 30000,
    predicate?: (data: TestEvents[T]) => boolean
  ): Promise<TestEvents[T]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data: TestEvents[T]) => {
        if (!predicate || predicate(data)) {
          clearTimeout(timer);
          this.off(event, handler);
          resolve(data);
        }
      };

      this.on(event, handler);
    });
  }

  /**
   * Wait for multiple events in sequence
   */
  async waitForSequence<T extends TestEventName[]>(
    events: T,
    timeout = 30000
  ): Promise<{ [K in keyof T]: TestEvents[T[K] & TestEventName] }> {
    const results: unknown[] = [];
    const startTime = Date.now();

    for (const event of events) {
      const remainingTime = timeout - (Date.now() - startTime);
      if (remainingTime <= 0) {
        throw new Error(`Timeout waiting for event sequence at: ${event}`);
      }
      const result = await this.waitForEvent(event as TestEventName, remainingTime);
      results.push(result);
    }

    return results as { [K in keyof T]: TestEvents[T[K] & TestEventName] };
  }
}

// Export singleton accessor
export const testEventService = TestEventService.getInstance();
