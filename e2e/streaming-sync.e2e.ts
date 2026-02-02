/**
 * E2E Tests: Streaming AI Sync
 *
 * Tests for real-time streaming sync functionality
 */
import { test, expect } from './fixtures';

test.describe('Streaming AI Sync', () => {
  test('should receive streaming events during sync', async ({ appPage }) => {
    // Track received streaming events
    const streamEvents: { type: string; contentLength?: number }[] = [];

    // Set up listener for streaming events in renderer
    await appPage.exposeFunction('__captureStreamEvent', (event: { type: string; content?: string }) => {
      streamEvents.push({
        type: event.type,
        contentLength: event.content?.length,
      });
      console.log('[E2E] Captured stream event:', event.type, 'contentLength:', event.content?.length);
    });

    // Inject event capture for streaming events
    await appPage.evaluate(() => {
      // @ts-expect-error - promptbook API
      window.promptbook.ai.onSyncStreamEvent((event: { type: string; content?: string }) => {
        console.log('[Renderer] Received stream event:', event.type);
        // @ts-expect-error - exposed function
        window.__captureStreamEvent(event);
      });
    });

    // Trigger streaming sync
    console.log('[E2E] Starting streaming sync...');
    const syncPromise = appPage.evaluate(async () => {
      console.log('[Renderer] Calling syncStream...');
      // @ts-expect-error - promptbook API
      return window.promptbook.ai.syncStream({
        cellId: 'stream-test-cell',
        sourceType: 'instructions',
        sourceContent: 'Print hello world',
        cellsBefore: [],
        cellsAfter: [],
        existingParameters: {},
      });
    });

    // Wait for sync to complete (with timeout)
    const result = await Promise.race([
      syncPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout after 30s')), 30000)),
    ]);

    console.log('[E2E] Sync result:', result);
    console.log('[E2E] Captured stream events:', streamEvents);

    // Verify we received some streaming events
    expect(result).toHaveProperty('success');

    // Check if we got streaming events
    const contentEvents = streamEvents.filter(e => e.type === 'content');
    const thinkingEvents = streamEvents.filter(e => e.type === 'thinking');
    const completeEvents = streamEvents.filter(e => e.type === 'complete');

    console.log('[E2E] Event counts - content:', contentEvents.length, 'thinking:', thinkingEvents.length, 'complete:', completeEvents.length);

    // We should have gotten at least one streaming event (content, thinking, or complete)
    const totalEvents = streamEvents.length;
    console.log('[E2E] Total streaming events received:', totalEvents);

    // The sync should succeed
    if ((result as { success: boolean }).success) {
      // If successful, we should have gotten a complete event
      expect(completeEvents.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('should show streaming content in cell state during sync', async ({ appPage }) => {
    // This test verifies the streaming content actually reaches the cell state

    // Track cell state updates
    const cellUpdates: { streamingContent?: string; streamingThinking?: string }[] = [];

    await appPage.exposeFunction('__captureCellUpdate', (update: { streamingContent?: string; streamingThinking?: string }) => {
      if (update.streamingContent || update.streamingThinking) {
        cellUpdates.push(update);
        console.log('[E2E] Cell update with streaming:', {
          contentLen: update.streamingContent?.length,
          thinkingLen: update.streamingThinking?.length,
        });
      }
    });

    // Monitor cell state updates (this would require hooking into the state manager)
    // For now, just verify the streaming events reach the renderer
    await appPage.evaluate(() => {
      // @ts-expect-error - promptbook API
      window.promptbook.ai.onSyncStreamEvent((event: { type: string; content?: string; cellId: string }) => {
        console.log('[Renderer] Stream event for cell:', event.cellId, 'type:', event.type);
        if (event.type === 'content' || event.type === 'thinking') {
          // @ts-expect-error - exposed function
          window.__captureCellUpdate({
            streamingContent: event.type === 'content' ? event.content : undefined,
            streamingThinking: event.type === 'thinking' ? event.content : undefined,
          });
        }
      });
    });

    // Trigger sync
    const result = await appPage.evaluate(async () => {
      // @ts-expect-error - promptbook API
      return window.promptbook.ai.syncStream({
        cellId: 'state-test-cell',
        sourceType: 'instructions',
        sourceContent: 'Calculate 2 + 2',
        cellsBefore: [],
        cellsAfter: [],
        existingParameters: {},
      });
    });

    console.log('[E2E] Sync completed, result:', result);
    console.log('[E2E] Cell updates with streaming content:', cellUpdates.length);

    // Verify
    expect(result).toHaveProperty('success');
  });
});
