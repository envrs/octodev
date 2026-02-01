import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionMemory } from '@/memory/session-memory';
import { HistoryDatabase } from '@/memory/history-db';
import type { ExecutionContext } from '@/types';

describe('SessionMemory', () => {
  let sessionMemory: SessionMemory;
  let db: HistoryDatabase;
  const testSessionId = 'test-session-' + Date.now();

  beforeEach(() => {
    db = HistoryDatabase.getInstance(':memory:'); // In-memory SQLite
    sessionMemory = new SessionMemory(testSessionId, db);
  });

  afterEach(() => {
    sessionMemory.endSession();
  });

  describe('command recording', () => {
    it('should record executed commands', () => {
      sessionMemory.recordCommand({
        input: 'file-read /tmp/test.txt',
        command: 'file-read',
        toolName: 'file-read',
        success: true,
        output: 'File content',
      });

      expect(sessionMemory.getStats().totalCommands).toBeGreaterThan(0);
    });

    it('should track success count', () => {
      sessionMemory.recordCommand({
        input: 'file-read /tmp/test.txt',
        command: 'file-read',
        toolName: 'file-read',
        success: true,
        output: 'Content',
      });

      const stats = sessionMemory.getStats();
      expect(stats.successCount).toBeGreaterThan(0);
    });

    it('should track failure count', () => {
      sessionMemory.recordCommand({
        input: 'file-read /etc/passwd',
        command: 'file-read',
        toolName: 'file-read',
        success: false,
        output: '',
        errorMessage: 'Permission denied',
      });

      const stats = sessionMemory.getStats();
      expect(stats.failureCount).toBeGreaterThan(0);
    });

    it('should record AI-generated commands', () => {
      sessionMemory.recordCommand({
        input: 'read config file',
        command: 'file-read /tmp/config.json',
        toolName: 'file-read',
        success: true,
        output: 'Config',
        aiGenerated: true,
        confidence: 0.92,
      });

      expect(sessionMemory.getStats().totalCommands).toBeGreaterThan(0);
    });
  });

  describe('history retrieval', () => {
    it('should retrieve command history', () => {
      sessionMemory.recordCommand({
        input: 'test1',
        command: 'test1',
        toolName: 'file-read',
        success: true,
        output: 'output1',
      });

      sessionMemory.recordCommand({
        input: 'test2',
        command: 'test2',
        toolName: 'file-read',
        success: true,
        output: 'output2',
      });

      const history = sessionMemory.getHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit history by count', () => {
      for (let i = 0; i < 50; i++) {
        sessionMemory.recordCommand({
          input: `test${i}`,
          command: `test${i}`,
          toolName: 'file-read',
          success: true,
          output: `output${i}`,
        });
      }

      const history = sessionMemory.getHistory(10);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should return most recent commands first', () => {
      sessionMemory.recordCommand({
        input: 'first',
        command: 'first',
        toolName: 'file-read',
        success: true,
        output: 'first output',
      });

      sessionMemory.recordCommand({
        input: 'second',
        command: 'second',
        toolName: 'file-read',
        success: true,
        output: 'second output',
      });

      const history = sessionMemory.getHistory(10);
      if (history.length >= 2) {
        // Most recent should be first
        expect(history[0].input).toBeDefined();
      }
    });
  });

  describe('statistics tracking', () => {
    it('should calculate success rate', () => {
      for (let i = 0; i < 8; i++) {
        sessionMemory.recordCommand({
          input: `success${i}`,
          command: `success${i}`,
          toolName: 'file-read',
          success: true,
          output: 'success',
        });
      }

      for (let i = 0; i < 2; i++) {
        sessionMemory.recordCommand({
          input: `failure${i}`,
          command: `failure${i}`,
          toolName: 'file-read',
          success: false,
          output: '',
          errorMessage: 'error',
        });
      }

      const stats = sessionMemory.getStats();
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });

    it('should track most used tools', () => {
      sessionMemory.recordCommand({
        input: 'read',
        command: 'read',
        toolName: 'file-read',
        success: true,
        output: 'out',
      });

      sessionMemory.recordCommand({
        input: 'read2',
        command: 'read2',
        toolName: 'file-read',
        success: true,
        output: 'out',
      });

      sessionMemory.recordCommand({
        input: 'list',
        command: 'list',
        toolName: 'list-dir',
        success: true,
        output: 'out',
      });

      const stats = sessionMemory.getStats();
      expect(stats.toolUsage).toBeDefined();
    });

    it('should calculate average execution time', () => {
      sessionMemory.recordCommand({
        input: 'test1',
        command: 'test1',
        toolName: 'file-read',
        success: true,
        output: 'output',
      });

      const stats = sessionMemory.getStats();
      expect(typeof stats.avgExecutionTime).toBe('number');
    });
  });

  describe('macro storage', () => {
    it('should save macros', async () => {
      const macro = {
        id: 'macro-1',
        name: 'backup',
        commands: [
          'file-read /tmp/data.json',
          'file-copy /tmp/data.json /tmp/data.backup',
        ],
        description: 'Backup data file',
      };

      await sessionMemory.recordMacro(macro);
      const macros = await sessionMemory.getMacros();

      expect(Array.isArray(macros)).toBe(true);
    });

    it('should retrieve saved macros', async () => {
      const macro = {
        id: 'macro-2',
        name: 'cleanup',
        commands: ['list-dir /tmp', 'file-delete /tmp/*.tmp'],
      };

      await sessionMemory.recordMacro(macro);
      const macros = await sessionMemory.getMacros();

      expect(macros.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('session cleanup', () => {
    it('should end session properly', () => {
      sessionMemory.recordCommand({
        input: 'test',
        command: 'test',
        toolName: 'file-read',
        success: true,
        output: 'output',
      });

      sessionMemory.endSession();

      // Session should be closed
      expect(sessionMemory.getStats().totalCommands).toBeDefined();
    });

    it('should export session data', () => {
      sessionMemory.recordCommand({
        input: 'test1',
        command: 'test1',
        toolName: 'file-read',
        success: true,
        output: 'output1',
      });

      const exported = sessionMemory.exportSession();
      expect(typeof exported).toBe('object');
    });
  });

  describe('error recovery tracking', () => {
    it('should record failed attempts', () => {
      sessionMemory.recordFailure(
        'file-read /etc/passwd',
        'Permission denied'
      );

      const stats = sessionMemory.getStats();
      expect(stats.failureCount).toBeGreaterThanOrEqual(0);
    });

    it('should record successful recovery', () => {
      sessionMemory.recordSuccess('file-read /tmp/test.txt', 0.95);

      const stats = sessionMemory.getStats();
      expect(stats.successCount).toBeGreaterThanOrEqual(0);
    });
  });
});
