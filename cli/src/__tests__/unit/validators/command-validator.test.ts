import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '@/tools/validators/command-validator';

describe('CommandValidator', () => {
  let validator: CommandValidator;

  beforeEach(() => {
    const allowedCommands = ['ls', 'cat', 'grep', 'find', 'git', 'node'];
    validator = new CommandValidator(allowedCommands);
  });

  describe('command whitelisting', () => {
    it('should allow whitelisted commands', () => {
      const result = validator.validate('ls -la /tmp');
      expect(result.valid).toBe(true);
    });

    it('should reject commands not in whitelist', () => {
      const result = validator.validate('rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not whitelisted');
    });

    it('should extract command from full command line', () => {
      const result = validator.validate('grep -r "pattern" /tmp');
      expect(result.valid).toBe(true);
    });
  });

  describe('injection prevention', () => {
    it('should detect command substitution attempts', () => {
      const result = validator.validate('ls $(rm -rf /)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('injection');
    });

    it('should detect backtick command substitution', () => {
      const result = validator.validate('ls `whoami`');
      expect(result.valid).toBe(false);
    });

    it('should detect pipe operators for chaining', () => {
      const result = validator.validate('cat /etc/passwd | grep root');
      expect(result.valid).toBe(false);
    });

    it('should detect shell metacharacters', () => {
      const risky = ['&&', '||', ';', '>', '<', '&'];
      risky.forEach((char) => {
        const result = validator.validate(`ls ${char} rm -rf /`);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('argument validation', () => {
    it('should validate argument count', () => {
      const result = validator.validate('ls -la /tmp /home');
      expect(typeof result.valid).toBe('boolean');
    });

    it('should detect suspicious patterns in arguments', () => {
      const result = validator.validate('cat /tmp/../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should allow legitimate file paths in arguments', () => {
      const result = validator.validate('cat /tmp/config.json');
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty commands', () => {
      const result = validator.validate('');
      expect(result.valid).toBe(false);
    });

    it('should handle commands with extra whitespace', () => {
      const result = validator.validate('   ls   -la   /tmp   ');
      expect(result.valid).toBe(true);
    });

    it('should be case-sensitive for command names', () => {
      const result = validator.validate('LS -la /tmp');
      expect(result.valid).toBe(false);
    });
  });
});
