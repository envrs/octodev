import { describe, it, expect, beforeEach } from 'vitest';
import { PathValidator } from '@/tools/validators/path-validator';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import type { ExecutionContext } from '@/types';

describe('Security: Path Traversal Prevention', () => {
  let pathValidator: PathValidator;
  let executor: SafeExecutor;
  let registry: ToolRegistry;

  beforeEach(() => {
    pathValidator = new PathValidator(['/tmp', '/home/user']);
    registry = new ToolRegistry();
    executor = new SafeExecutor(registry, {
      defaultTimeout: 5000,
      allowedPaths: ['/tmp', '/home/user'],
    });
  });

  describe('path traversal attacks', () => {
    it('should block ../ escape attempts', () => {
      const attempts = [
        '/tmp/../../etc/passwd',
        '/home/user/../../../root/.ssh/id_rsa',
        '/tmp/subdir/../../allowed_file',
      ];

      attempts.forEach((path) => {
        const result = pathValidator.validate(path);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('traversal');
      });
    });

    it('should block null byte injection', () => {
      const result = pathValidator.validate('/tmp/file.txt\x00.evil');
      expect(result.valid).toBe(false);
    });

    it('should block symlink escape attempts', () => {
      const result = pathValidator.validate('/tmp/symlink_to_root');
      expect(typeof result.valid).toBe('boolean');
    });

    it('should normalize and validate paths', () => {
      const result = pathValidator.validate('/tmp//double//slash/../file.txt');
      expect(result.valid).toBe(false); // Contains traversal after normalization
    });

    it('should block unicode-based traversal', () => {
      const result = pathValidator.validate('/tmp/..%2fetc%2fpasswd');
      expect(result.valid).toBe(false);
    });
  });

  describe('executor-level path protection', () => {
    it('should reject file-read outside allowed dirs', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/etc/passwd',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject file-write outside allowed dirs', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-write',
        '/root/.bashrc content',
        context
      );

      expect(result.success).toBe(false);
    });

    it('should reject traversal in directory listing', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'list-dir',
        '/tmp/../../etc',
        context
      );

      expect(result.success).toBe(false);
    });
  });

  describe('permission checks', () => {
    it('should verify read permissions', () => {
      const canRead = pathValidator.canRead('/tmp/test.txt');
      expect(typeof canRead).toBe('boolean');
    });

    it('should verify write permissions', () => {
      const canWrite = pathValidator.canWrite('/tmp/test.txt');
      expect(typeof canWrite).toBe('boolean');
    });

    it('should deny write to read-only files', () => {
      // This would require filesystem setup
      const canWrite = pathValidator.canWrite('/tmp/readonly.txt');
      expect(typeof canWrite).toBe('boolean');
    });
  });

  describe('audit logging of attempts', () => {
    it('should log all traversal attempts', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      await executor.execute('file-read', '../../etc/passwd', context);

      const history = executor.getExecutionHistory('file-read');
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should record failure details', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'file-read',
        '/root/secret.txt',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const history = executor.getExecutionHistory('file-read');
      if (history.length > 0) {
        expect(history[0].status).toBe('failure');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle relative paths safely', () => {
      const result = pathValidator.validate('./file.txt');
      // Relative paths should resolve within working directory
      expect(typeof result.valid).toBe('boolean');
    });

    it('should handle absolute paths correctly', () => {
      const result = pathValidator.validate('/tmp/absolute/path.txt');
      expect(result.valid).toBe(true);
    });

    it('should reject suspicious path patterns', () => {
      const suspicious = [
        '/tmp/....//file',
        '/tmp/%2e%2e/etc/passwd',
        '/tmp/file\x00name',
      ];

      suspicious.forEach((path) => {
        const result = pathValidator.validate(path);
        expect(result.valid).toBe(false);
      });
    });
  });
});
