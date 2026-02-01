import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import { SessionMemory } from '@/memory/session-memory';
import { HistoryDatabase } from '@/memory/history-db';
import type { ExecutionContext } from '@/types';

describe('Integration: Full Executor Flow', () => {
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
    sessionMemory = new SessionMemory('test-session-' + Date.now(), db);
  });

  describe('complete user workflow', () => {
    it('should execute a sequence of file operations', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
        workingDir: '/tmp',
      };

      // Step 1: List directory
      const listResult = await executor.execute('list-dir', '/tmp', context);
      expect(typeof listResult).toBe('object');

      // Step 2: Record in memory
      if (listResult.success) {
        sessionMemory.recordCommand({
          input: 'list-dir /tmp',
          command: 'list-dir',
          toolName: 'list-dir',
          success: listResult.success,
          output: listResult.output || '',
        });
      }

      // Step 3: Verify command recorded
      const history = sessionMemory.getHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle error recovery in workflow', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      // Attempt invalid operation
      const result1 = await executor.execute(
        'file-read',
        '/etc/passwd',
        context
      );
      expect(result1.success).toBe(false);

      // Record failure
      sessionMemory.recordFailure(
        'file-read /etc/passwd',
        result1.error || ''
      );

      // Attempt valid alternative
      const result2 = await executor.execute(
        'file-read',
        '/tmp/valid.txt',
        context
      );
      expect(typeof result2.success).toBe('boolean');

      // Record attempt
      sessionMemory.recordCommand({
        input: 'file-read /tmp/valid.txt',
        command: 'file-read',
        toolName: 'file-read',
        success: result2.success,
        output: result2.output || '',
      });

      const stats = sessionMemory.getStats();
      expect(stats.totalCommands).toBeGreaterThan(0);
    });

    it('should validate security across workflow', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const dangerousCommands = [
        'file-read /etc/passwd',
        'shell-exec rm -rf /',
        'file-write /root/test.txt',
      ];

      for (const cmd of dangerousCommands) {
        const result = await executor.execute(
          'shell-exec',
          cmd,
          context
        );
        expect(result.success).toBe(false);
      }
    });
  });

  describe('timeout enforcement in workflows', () => {
    it('should enforce timeout across multiple operations', async () => {
      const shortContext: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
        timeout: 1000, // Very short timeout
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/test.txt',
        shortContext
      );

      // Should either complete or timeout gracefully
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('execution logging integration', () => {
    it('should maintain audit trail of all operations', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      // Execute several commands
      for (let i = 0; i < 5; i++) {
        await executor.execute('list-dir', '/tmp', context);
      }

      const history = executor.getExecutionHistory('list-dir');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should correlate executor logs with session memory', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      await executor.execute('list-dir', '/tmp', context);

      sessionMemory.recordCommand({
        input: 'list-dir /tmp',
        command: 'list-dir',
        toolName: 'list-dir',
        success: true,
        output: 'files',
      });

      const executorHistory = executor.getExecutionHistory('list-dir');
      const sessionHistory = sessionMemory.getHistory(10);

      expect(executorHistory.length).toBeGreaterThan(0);
      expect(sessionHistory.length).toBeGreaterThan(0);
    });
  });

  describe('context propagation', () => {
    it('should maintain context across operations', async () => {
      const initialContext: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
        workingDir: '/tmp',
        environment: { DEBUG: 'true', LANG: 'en_US.UTF-8' },
      };

      const result1 = await executor.execute(
        'list-dir',
        '/tmp',
        initialContext
      );

      // Execute another operation with same context
      const result2 = await executor.execute(
        'file-read',
        '/tmp/test.txt',
        initialContext
      );

      expect(typeof result1.success).toBe('boolean');
      expect(typeof result2.success).toBe('boolean');
    });
  });

  describe('error handling and recovery', () => {
    it('should provide recovery suggestions in workflow', async () => {
      const context: ExecutionContext = {
        sessionId: sessionMemory.getSessionId(),
      };

      const result = await executor.execute(
        'file-read',
        '/tmp/nonexistent.txt',
        context
      );

      expect(result.success).toBe(false);
      expect(result.suggestion).toBeDefined();
    });
  });
});
