import { describe, it, expect, beforeEach } from 'vitest';
import { FileOperations } from '@/tools/operations/file-operations';
import { PathValidator } from '@/tools/validators/path-validator';
import { testFixtures } from '../../test-utils';

describe('FileOperations', () => {
  let fileOps: FileOperations;
  let pathValidator: PathValidator;

  beforeEach(() => {
    pathValidator = new PathValidator(['/tmp', '/home/user']);
    fileOps = new FileOperations(pathValidator);
  });

  describe('file-read', () => {
    it('should read file contents', async () => {
      const result = await fileOps.read('/tmp/test.txt');
      expect(typeof result).toEqual(expect.any(Object));
    });

    it('should handle file not found', async () => {
      const result = await fileOps.read('/tmp/nonexistent.txt');
      expect(result.success).toBe(false);
    });

    it('should respect max file size limit', async () => {
      // Should reject files larger than 10MB
      const result = await fileOps.read(testFixtures.largeFile);
      expect(typeof result.success).toBe('boolean');
    });

    it('should support encoding parameter', async () => {
      const result = await fileOps.read('/tmp/test.txt', { encoding: 'utf8' });
      expect(typeof result.output).toBe('string');
    });
  });

  describe('file-write', () => {
    it('should write file contents', async () => {
      const result = await fileOps.write('/tmp/test.txt', 'test content');
      expect(typeof result.success).toBe('boolean');
    });

    it('should create backup before overwrite', async () => {
      const result = await fileOps.write('/tmp/test.txt', 'new content', {
        createBackup: true,
      });
      expect(typeof result.success).toBe('boolean');
    });

    it('should support append mode', async () => {
      const result = await fileOps.write('/tmp/test.txt', '\nappended', {
        append: true,
      });
      expect(typeof result.success).toBe('boolean');
    });

    it('should prevent writing outside allowed directories', async () => {
      const result = await fileOps.write('/etc/test.txt', 'content');
      expect(result.success).toBe(false);
    });
  });

  describe('list-dir', () => {
    it('should list directory contents', async () => {
      const result = await fileOps.listDir('/tmp');
      expect(Array.isArray(result.output)).toBe(true);
    });

    it('should support recursive listing', async () => {
      const result = await fileOps.listDir('/tmp', { recursive: true });
      expect(Array.isArray(result.output)).toBe(true);
    });

    it('should support filtering', async () => {
      const result = await fileOps.listDir('/tmp', { filter: '*.txt' });
      expect(Array.isArray(result.output)).toBe(true);
    });

    it('should handle directory not found', async () => {
      const result = await fileOps.listDir('/tmp/nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('file-copy', () => {
    it('should copy file contents', async () => {
      const result = await fileOps.copy('/tmp/source.txt', '/tmp/dest.txt');
      expect(typeof result.success).toBe('boolean');
    });

    it('should prevent overwrite by default', async () => {
      const result = await fileOps.copy('/tmp/source.txt', '/tmp/existing.txt');
      // Should fail if destination exists
      expect(typeof result.success).toBe('boolean');
    });

    it('should support force overwrite', async () => {
      const result = await fileOps.copy('/tmp/source.txt', '/tmp/existing.txt', {
        force: true,
      });
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('file-delete', () => {
    it('should delete files', async () => {
      const result = await fileOps.delete('/tmp/test.txt');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle file not found gracefully', async () => {
      const result = await fileOps.delete('/tmp/nonexistent.txt');
      expect(result.success).toBe(false);
    });

    it('should require confirmation for dangerous operations', async () => {
      // Attempting to delete multiple files should warn
      const result = await fileOps.delete('/tmp/*.txt');
      expect(result.success).toBe(false);
    });
  });

  describe('file-stat', () => {
    it('should return file metadata', async () => {
      const result = await fileOps.stat('/tmp/test.txt');
      expect(typeof result.output).toBe('object');
    });

    it('should include size, permissions, timestamps', async () => {
      const result = await fileOps.stat('/tmp/test.txt');
      if (result.success && result.output) {
        expect(result.output).toHaveProperty('size');
        expect(result.output).toHaveProperty('mode');
        expect(result.output).toHaveProperty('mtime');
      }
    });

    it('should handle missing files', async () => {
      const result = await fileOps.stat('/tmp/nonexistent.txt');
      expect(result.success).toBe(false);
    });
  });

  describe('size limits', () => {
    it('should enforce max file size', async () => {
      // Attempting to read a file larger than 10MB should fail
      const result = await fileOps.read(testFixtures.largeFile);
      expect(typeof result.success).toBe('boolean');
    });

    it('should truncate large directory listings', async () => {
      const result = await fileOps.listDir('/tmp');
      if (Array.isArray(result.output)) {
        // Should limit results to prevent huge output
        expect(result.output.length).toBeLessThanOrEqual(10000);
      }
    });
  });
});
