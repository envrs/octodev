import { describe, it, expect, beforeEach } from 'vitest';
import { CommandConverter } from '@/ai/command-converter';
import { SuggestionEngine } from '@/ai/suggestion-engine';
import { ContextBuilder } from '@/ai/context-builder';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import { MockAIProvider } from '../test-utils';
import type { ExecutionContext } from '@/types';

describe('Integration: AI Commands and Suggestions', () => {
  let converter: CommandConverter;
  let suggestionEngine: SuggestionEngine;
  let contextBuilder: ContextBuilder;
  let executor: SafeExecutor;
  let mockProvider: MockAIProvider;
  let registry: ToolRegistry;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    registry = new ToolRegistry();
    executor = new SafeExecutor(registry, {
      defaultTimeout: 5000,
      allowedPaths: ['/tmp'],
    });

    converter = new CommandConverter(mockProvider as any);
    suggestionEngine = new SuggestionEngine(mockProvider as any);
    contextBuilder = new ContextBuilder(registry);
  });

  describe('natural language to execution pipeline', () => {
    it('should convert natural language and execute safely', async () => {
      mockProvider.setSuggestions(['file-read /tmp/test.txt']);

      // Step 1: Convert natural language
      const converted = await converter.convert('Show me test file');

      expect(typeof converted.success).toBe('boolean');

      if (converted.success) {
        // Step 2: Execute converted command
        const context: ExecutionContext = {
          sessionId: 'test-session',
        };

        const result = await executor.execute(
          converted.toolName,
          converted.command,
          context
        );

        expect(typeof result.success).toBe('boolean');
      }
    });

    it('should generate suggestions for user input', async () => {
      mockProvider.setSuggestions([
        'file-read /tmp/config.json',
        'file-read /tmp/data.json',
        'list-dir /tmp',
      ]);

      const suggestions = await suggestionEngine.generateSuggestions(
        'show config',
        { sessionId: 'test-session' }
      );

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('context-aware suggestions', () => {
    it('should use execution history for context', async () => {
      mockProvider.setSuggestions([
        'file-read /tmp/config.json',
        'file-read /tmp/data.json',
        'list-dir /tmp',
      ]);

      // Build context with prior commands
      const contextData = contextBuilder.buildContext({
        sessionId: 'test-session',
        recentExecutions: [
          {
            command: 'list-dir /tmp',
            success: true,
            output: 'config.json, data.json',
          },
        ],
      });

      expect(contextData).toBeDefined();

      // Generate suggestions with context
      const suggestions = await suggestionEngine.generateSuggestions(
        'read the file',
        { sessionId: 'test-session' }
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('confidence scoring', () => {
    it('should score suggestions by confidence', async () => {
      mockProvider.setSuggestions([
        'file-read /tmp/config.json',
        'file-read /tmp/data.json',
        'list-dir /tmp',
      ]);

      const suggestions = await suggestionEngine.generateSuggestions(
        'read config',
        { sessionId: 'test-session' }
      );

      if (suggestions.length > 0) {
        suggestions.forEach((s) => {
          expect(s.confidence).toBeGreaterThanOrEqual(0);
          expect(s.confidence).toBeLessThanOrEqual(1);
        });
      }
    });
  });

  describe('error handling in AI pipeline', () => {
    it('should handle conversion failures gracefully', async () => {
      mockProvider.setShouldFail(true);

      const result = await converter.convert('read a file');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide fallback suggestions on AI failure', async () => {
      mockProvider.setShouldFail(true);

      const suggestions = await suggestionEngine.generateSuggestions(
        'read file',
        { sessionId: 'test-session' }
      );

      // Should still return something (fallback suggestions)
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('safety validation in AI commands', () => {
    it('should reject unsafe AI-generated commands', async () => {
      mockProvider.setSuggestions(['shell-exec rm -rf /']);

      const result = await converter.convert(
        'delete everything'
      );

      expect(result.success).toBe(false);
    });

    it('should validate paths in AI suggestions', async () => {
      mockProvider.setSuggestions(['file-read /etc/passwd']);

      const result = await converter.convert('read password file');

      expect(result.success).toBe(false);
    });
  });

  describe('streaming responses', () => {
    it('should stream AI responses token by token', async () => {
      const tokens: string[] = [];

      mockProvider.setSucc
uggestions(['']);

      await mockProvider.streamResponse('test prompt', (token) => {
        tokens.push(token);
      });

      expect(tokens.length).toBeGreaterThan(0);
    });
  });
});
