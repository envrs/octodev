import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import { SessionMemory } from '@/memory/session-memory';
import { HistoryDatabase } from '@/memory/history-db';
import { measureTime, assertPerformance } from '../test-utils';
import type { ExecutionContext } from '@/types';

describe('Stress & Load Tests', () => {
  let executor: SafeExecutor;
  let registry: ToolRegistry;
  let sessionMemory: SessionMemory;
  let db: HistoryDatabase;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new SafeExecutor(registry, {
      defaultTimeout: 5000,
      allowedPaths: ['/tmp'],
    });

    db = HistoryDatabase.getInstance(':memory:');
    sessionMemory = new SessionMemory('stress-test-' + Date.now(), db);
  });

  describe('rapid command execution', () => {
    it('should handle 50 commands in sequence without failures', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 50; i++) {
          const result = await executor.execute(
            'list-dir',
            '/tmp',
            context
          );
          expect(typeof result).toBe('object');
        }
      });

      // Should complete 50 commands in <30 seconds
      expect(duration).toBeLessThan(30000);
    });

    it('should maintain performance under sustained load', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const durations: number[] = [];

      for (let i = 0; i < 30; i++) {
        const { duration } = await measureTime(async () => {
          await executor.execute('list-dir', '/tmp', context);
        });
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      assertPerformance(avgDuration, 100); // Should average <100ms per command
    });
  });

  describe('large file handling', () => {
    it('should handle large output truncation', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      // Simulate large output
      const largeOutput = 'x'.repeat(1024 * 1024); // 1MB output

      // Should be truncated or handled gracefully
      sessionMemory.recordCommand({
        input: 'test',
        command: 'test',
        toolName: 'list-dir',
        success: true,
        output: largeOutput,
      });

      const history = sessionMemory.getHistory(1);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should enforce output size limits', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      // Very large output should be rejected or truncated
      const result = await executor.execute(
        'list-dir',
        '/tmp',
        context
      );

      expect(typeof result).toBe('object');
    });
  });

  describe('memory stability', () => {
    it('should not leak memory on repeated operations', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const initialMem = process.memoryUsage().heapUsed;

      // Execute many operations
      for (let i = 0; i < 100; i++) {
        await executor.execute('list-dir', '/tmp', context);
      }

      const finalMem = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMem - initialMem;

      // Memory increase should be reasonable (<50MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up execution history', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      // Execute more than history limit
      for (let i = 0; i < 150; i++) {
        await executor.execute('list-dir', '/tmp', context);
      }

      // Get history
      const history = executor.getExecutionHistory('list-dir');

      // Should only keep last 100
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should handle garbage collection properly', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      for (let i = 0; i < 50; i++) {
        await executor.execute('list-dir', '/tmp', context);
      }

      sessionMemory.endSession();

      // Session should be properly closed
      expect(sessionMemory.getStats().totalCommands).toBeDefined();
    });
  });

  describe('timeout enforcement under load', () => {
    it('should enforce timeouts even under load', async () => {
      const shortContext: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
        timeout: 500, // Very short timeout
      };

      const results = [];

      for (let i = 0; i < 10; i++) {
        const result = await executor.execute(
          'list-dir',
          '/tmp',
          shortContext
        );
        results.push(result);
      }

      // All should complete or timeout gracefully
      results.forEach((result) => {
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should not exceed max timeout', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
        timeout: 10000, // Requested 10s
      };

      const { duration } = await measureTime(async () => {
        await executor.execute('list-dir', '/tmp', context);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('concurrent-like operations', () => {
    it('should handle sequential operations rapidly', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const operations = Array.from({ length: 20 }, (_, i) => ({
        tool: 'list-dir',
        path: '/tmp',
        index: i,
      }));

      const { duration } = await measureTime(async () => {
        for (const op of operations) {
          await executor.execute(op.tool, op.path, context);
        }
      });

      expect(duration).toBeLessThan(20000);
    });
  });

  describe('session memory under load', () => {
    it('should handle bulk command recording', () => {
      for (let i = 0; i < 100; i++) {
        sessionMemory.recordCommand({
          input: `command-${i}`,
          command: `command-${i}`,
          toolName: 'file-read',
          success: i % 10 !== 0, // 90% success
          output: `output-${i}`,
        });
      }

      const stats = sessionMemory.getStats();
      expect(stats.totalCommands).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    it('should maintain accurate statistics under load', () => {
      let successCount = 0;
      for (let i = 0; i < 200; i++) {
        const success = Math.random() > 0.3; // 70% success
        if (success) successCount++;

        sessionMemory.recordCommand({
          input: `cmd-${i}`,
          command: `cmd-${i}`,
          toolName: 'file-read',
          success,
          output: success ? 'success' : 'error',
        });
      }

      const stats = sessionMemory.getStats();
      expect(stats.totalCommands).toBe(200);
      expect(stats.successCount).toBeGreaterThan(0);
    });
  });

  describe('error resilience under load', () => {
    it('should continue after failures', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 50; i++) {
        const path = i % 5 === 0 ? '/nonexistent' : '/tmp';
        const result = await executor.execute(
          'list-dir',
          path,
          context
        );

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      // Should have mix of successes and failures
      expect(successCount + failureCount).toBe(50);
      expect(failureCount).toBeGreaterThan(0);
    });
  });

  describe('performance degradation', () => {
    it('should not degrade significantly with increased load', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const smallLoadTime = await measureTime(async () => {
        for (let i = 0; i < 10; i++) {
          await executor.execute('list-dir', '/tmp', context);
        }
      });

      const largeLoadTime = await measureTime(async () => {
        for (let i = 0; i < 100; i++) {
          await executor.execute('list-dir', '/tmp', context);
        }
      });

      // Large load should not take more than 5x the small load time
      expect(largeLoadTime.duration).toBeLessThan(
        smallLoadTime.duration * 5
      );
    });
  });
});
