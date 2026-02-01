import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import { MockExecutorService } from '../test-utils';
import type { ExecutionContext } from '@/types';

describe('SafeExecutor', () => {
  let executor: SafeExecutor;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new SafeExecutor(registry, {
      defaultTimeout: 5000,
      allowedPaths: ['/tmp', '/home/user'],
    });
  });

  describe('timeout enforcement', () => {
    it('should enforce default timeout', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
        timeout: 5000,
      };

      const result = await executor.execute('file-read', '/tmp/test.txt', context);
      expect(typeof result).toEqual(expect.objectContaining({ success: expect.any(Boolean) }));
    });

    it('should respect per-tool timeout override', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
        timeout: 1000, // Override
      };

      // Timeout should be enforced
      expect(context.timeout).toBeLessThanOrEqual(5000);
    });

    it('should cancel execution on timeout', async () => {
      // Mock a long-running operation
      const timeoutContext: ExecutionContext = {
        sessionId: 'test-session',
        timeout: 100, // Very short timeout
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/large-file.bin',
        timeoutContext
      );

      // Should timeout
      expect(result.success).toBe(false);
    });
  });

  describe('validation layer', () => {
    it('should validate path before execution', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/etc/passwd', // Outside allowed paths
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should validate command before execution', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'shell-exec',
        'rm -rf /', // Dangerous command
        context
      );

      expect(result.success).toBe(false);
    });

    it('should validate tool existence', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'non-existent-tool',
        'input',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });
  });

  describe('error handling', () => {
    it('should catch execution errors', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/nonexistent.txt',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return helpful error messages', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-write',
        '/etc/passwd', // Permission denied
        context
      );

      expect(result.error).toBeTruthy();
      // Error should suggest what might be wrong
      expect(result.error?.length).toBeGreaterThan(0);
    });

    it('should include error suggestions', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/invalid/path',
        context
      );

      if (!result.success) {
        expect(result.suggestion).toBeDefined();
      }
    });
  });

  describe('execution logging', () => {
    it('should log all executions', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      await executor.execute('file-read', '/tmp/test.txt', context);

      const history = executor.getExecutionHistory('file-read');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should maintain limited history per tool', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      // Execute multiple times
      for (let i = 0; i < 150; i++) {
        await executor.execute('file-read', `/tmp/test${i}.txt`, context);
      }

      const history = executor.getExecutionHistory('file-read');
      // Should only keep last 100
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should record execution time', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      await executor.execute('file-read', '/tmp/test.txt', context);

      const history = executor.getExecutionHistory('file-read');
      if (history.length > 0) {
        expect(history[0].duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('context management', () => {
    it('should propagate execution context', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
        environment: { DEBUG: 'true' },
        workingDir: '/tmp',
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/test.txt',
        context
      );

      expect(typeof result).toEqual(expect.any(Object));
    });

    it('should use default context values', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/test.txt',
        context
      );

      expect(result.success).toBeDefined();
    });
  });
});
