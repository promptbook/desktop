import { useState, useCallback } from 'react';
import type { AIAssistanceMessage } from '@promptbook/core';

export interface UseAIAssistanceReturn {
  messages: AIAssistanceMessage[];
  sendMessage: (content: string, currentCode: string) => Promise<void>;
  isLoading: boolean;
  clearHistory: () => void;
}

/**
 * Hook to manage AI assistance conversation for a cell.
 * Provides chat-style interface for code modification suggestions.
 */
export function useAIAssistance(): UseAIAssistanceReturn {
  const [messages, setMessages] = useState<AIAssistanceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string, currentCode: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: AIAssistanceMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call AI with code assist direction
      const result = await window.promptbook.ai.sync('', 'codeAssist', {
        newContent: content.trim(), // User's request
        existingCounterpart: currentCode, // Current code to modify
      });

      if (result.success && result.result) {
        // Parse the response for code suggestion
        const { textContent, codeContent } = parseAIResponse(result.result);

        const assistantMessage: AIAssistanceMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: textContent || 'Here is the modified code:',
          suggestedCode: codeContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Error response
        const errorMessage: AIAssistanceMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: result.error || 'Sorry, I encountered an error. Please try again.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: AIAssistanceMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error: ${String(error)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, isLoading, clearHistory };
}

/**
 * Parse AI response to extract text explanation and code suggestion.
 * Handles responses that may include markdown code blocks.
 */
function parseAIResponse(response: string): { textContent: string; codeContent?: string } {
  // Look for ```python ... ``` code blocks
  const codeBlockRegex = /```(?:python)?\s*([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];

  if (matches.length > 0) {
    // Extract code from the last code block (most likely the final suggestion)
    const codeContent = matches[matches.length - 1][1].trim();

    // Remove code blocks from text to get the explanation
    const textContent = response
      .replace(codeBlockRegex, '')
      .trim()
      .replace(/\n{3,}/g, '\n\n'); // Clean up excessive newlines

    return { textContent: textContent || 'Here is the modified code:', codeContent };
  }

  // If no code blocks, check if the entire response looks like code
  const looksLikeCode =
    response.includes('def ') ||
    response.includes('import ') ||
    response.includes('class ') ||
    response.includes('print(') ||
    response.includes(' = ');

  if (looksLikeCode && !response.includes('\n\n')) {
    // Likely just code without explanation
    return { textContent: 'Here is the modified code:', codeContent: response.trim() };
  }

  // Otherwise, treat as plain text response
  return { textContent: response.trim() };
}
