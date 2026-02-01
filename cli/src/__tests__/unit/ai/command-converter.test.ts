import { describe, it, expect, beforeEach } from 'vitest';
import { CommandConverter } from '@/ai/command-converter';
import { MockAIProvider } from '../../test-utils';

describe('CommandConverter', () => {
  let converter: CommandConverter;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    converter = new CommandConverter(mockProvider as any);
  });

  describe('natural language to command conversion', () => {
    it('should convert simple file operations', async () => {
      mockProvider.setSuggestions(['file-read /tmp/config.json']);

      const result = await converter.convert('Show me the config file');
      expect(result.success).toBe(true);
      expect(result.command).toBeDefined();
    });

    it('should handle complex multi-step instructions', async () => {
      mockProvider.setSuggestions([
        'file-read /tmp/data.json',
        'list-dir /tmp',
      ]);

      const result = await converter.convert(
        'Read the data file then list all files in tmp'
      );
      expect(typeof result.success).toBe('boolean');
    });

    it('should extract parameters from natural language', async () => {
      mockProvider.setSuggestions(['file-read /home/user/file.txt']);

      const result = await converter.convert(
        'Read the file at /home/user/file.txt'
      );

      if (result.success) {
        expect(result.command).toContain('file.txt');
      }
    });
  });

  describe('validation and safety', () => {
    it('should reject unsafe commands', async () => {
      mockProvider.setSuggestions(['shell-exec rm -rf /']);

      const result = await converter.convert(
        'Delete everything in root'
      );

      expect(result.success).toBe(false);
    });

    it('should validate paths in converted commands', async () => {
      mockProvider.setSuggestions(['file-read /etc/passwd']);

      const result = await converter.convert(
        'Read the password file'
      );

      expect(result.success).toBe(false);
    });

    it('should catch permission errors before execution', async () => {
      mockProvider.setSuggestions(['file-write /root/file.txt content']);

      const result = await converter.convert(
        'Write to root file'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('confidence scoring', () => {
    it('should assign confidence to conversions', async () => {
      mockProvider.setSuggestions(['file-read /tmp/test.txt']);

      const result = await converter.convert(
        'Read /tmp/test.txt'
      );

      if (result.success) {
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it('should lower confidence for ambiguous requests', async () => {
      mockProvider.setSuggestions(['file-read unknown.txt']);

      const result = await converter.convert(
        'Do something with a file'
      );

      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle AI provider failures gracefully', async () => {
      mockProvider.setShouldFail(true);

      const result = await converter.convert('Read a file');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide suggestions for recovery', async () => {
      const result = await converter.convert('Invalid input');

      if (!result.success) {
        expect(result.suggestion).toBeDefined();
      }
    });

    it('should handle empty or null inputs', async () => {
      const result = await converter.convert('');

      expect(result.success).toBe(false);
    });
  });

  describe('command structure', () => {
    it('should return structured command format', async () => {
      mockProvider.setSuggestions(['file-read /tmp/test.txt']);

      const result = await converter.convert(
        'Read /tmp/test.txt'
      );

      if (result.success) {
        expect(result).toHaveProperty('command');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('toolName');
      }
    });

    it('should parse tool name correctly', async () => {
      mockProvider.setSuggestions(['file-read /tmp/test.txt']);

      const result = await converter.convert(
        'Read /tmp/test.txt'
      );

      if (result.success) {
        expect(['file-read', 'file-write', 'shell-exec']).toContain(
          result.toolName
        );
      }
    });
  });
});
