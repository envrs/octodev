/**
 * Execution Configuration - Settings for SafeExecutor
 */

import { z } from 'zod';

/**
 * Validation schema for execution config
 */
export const ExecutionConfigSchema = z.object({
  // Timeout settings
  execution: z.object({
    defaultTimeout: z.number().positive().default(30000),
    maxTimeout: z.number().positive().default(300000),
    toolTimeouts: z.record(z.number().positive()).optional().default({}),
  }).optional(),

  // File access settings
  filesystem: z.object({
    allowedDirectories: z.array(z.string()).default([process.cwd()]),
    maxFileSize: z.number().positive().default(10 * 1024 * 1024),
    maxOutputSize: z.number().positive().default(1024 * 1024),
    allowSymlinks: z.boolean().default(false),
  }).optional(),

  // Command execution settings
  commands: z.object({
    whitelistedCommands: z.array(z.string()).optional(),
    blockedCommands: z.array(z.string()).default([
      'rm', 'rmdir', 'mkfs', 'dd', 'mount', 'umount',
      'passwd', 'su', 'sudo', 'chmod', 'chown'
    ]),
    allowCommandSubstitution: z.boolean().default(false),
    allowPipeOperators: z.boolean().default(true),
  }).optional(),

  // Security settings
  security: z.object({
    enableAuditLogging: z.boolean().default(true),
    enableProcessMonitoring: z.boolean().default(true),
    maxProcessCount: z.number().positive().default(10),
    maxMemoryUsage: z.number().positive().default(512 * 1024 * 1024),
  }).optional(),
});

export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

/**
 * Default execution configuration
 */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  execution: {
    defaultTimeout: 30000,
    maxTimeout: 300000,
    toolTimeouts: {
      'file-read': 5000,
      'file-write': 5000,
      'list-dir': 5000,
      'file-stat': 3000,
      'file-copy': 10000,
      'shell-exec': 30000,
    },
  },
  filesystem: {
    allowedDirectories: [process.cwd()],
    maxFileSize: 10 * 1024 * 1024,
    maxOutputSize: 1024 * 1024,
    allowSymlinks: false,
  },
  commands: {
    whitelistedCommands: [
      'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'head', 'tail',
      'wc', 'sort', 'uniq', 'cut', 'tr', 'sed', 'awk',
      'mkdir', 'touch', 'cp', 'mv', 'date', 'whoami', 'which',
      'file', 'stat', 'git', 'node', 'npm', 'yarn', 'python',
      'pnpm', 'bun', 'deno'
    ],
    blockedCommands: [
      'rm', 'rmdir', 'mkfs', 'dd', 'mount', 'umount',
      'passwd', 'su', 'sudo', 'chmod', 'chown'
    ],
    allowCommandSubstitution: false,
    allowPipeOperators: true,
  },
  security: {
    enableAuditLogging: true,
    enableProcessMonitoring: true,
    maxProcessCount: 10,
    maxMemoryUsage: 512 * 1024 * 1024,
  },
};

/**
 * Execution configuration manager
 */
export class ExecutionConfigManager {
  private config: ExecutionConfig;

  constructor(customConfig?: Partial<ExecutionConfig>) {
    try {
      this.config = ExecutionConfigSchema.parse({
        ...DEFAULT_EXECUTION_CONFIG,
        ...customConfig,
      });
    } catch (error) {
      throw new Error(`Invalid execution configuration: ${error}`);
    }
  }

  /**
   * Get the full configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Get timeout for a specific tool
   */
  getToolTimeout(toolId: string): number {
    const timeout = this.config.execution?.toolTimeouts?.[toolId];
    return timeout || this.config.execution?.defaultTimeout || 30000;
  }

  /**
   * Set timeout for a specific tool
   */
  setToolTimeout(toolId: string, timeout: number): void {
    if (!this.config.execution) {
      this.config.execution = {};
    }
    if (!this.config.execution.toolTimeouts) {
      this.config.execution.toolTimeouts = {};
    }

    const maxTimeout = this.config.execution.maxTimeout || 300000;
    if (timeout > maxTimeout) {
      throw new Error(`Timeout ${timeout}ms exceeds maximum ${maxTimeout}ms`);
    }

    this.config.execution.toolTimeouts[toolId] = timeout;
  }

  /**
   * Get allowed directories
   */
  getAllowedDirectories(): string[] {
    return this.config.filesystem?.allowedDirectories || [process.cwd()];
  }

  /**
   * Add an allowed directory
   */
  addAllowedDirectory(dir: string): void {
    if (!this.config.filesystem) {
      this.config.filesystem = { allowedDirectories: [] };
    }
    if (!this.config.filesystem.allowedDirectories) {
      this.config.filesystem.allowedDirectories = [];
    }

    if (!this.config.filesystem.allowedDirectories.includes(dir)) {
      this.config.filesystem.allowedDirectories.push(dir);
    }
  }

  /**
   * Get whitelisted commands
   */
  getWhitelistedCommands(): string[] {
    return this.config.commands?.whitelistedCommands || [];
  }

  /**
   * Add a command to whitelist
   */
  addWhitelistedCommand(command: string): void {
    if (!this.config.commands) {
      this.config.commands = {};
    }
    if (!this.config.commands.whitelistedCommands) {
      this.config.commands.whitelistedCommands = [];
    }

    if (!this.config.commands.whitelistedCommands.includes(command)) {
      this.config.commands.whitelistedCommands.push(command);
    }
  }

  /**
   * Check if a command is blocked
   */
  isCommandBlocked(command: string): boolean {
    return (this.config.commands?.blockedCommands || []).includes(command);
  }

  /**
   * Get file size limits
   */
  getFileSizeLimits(): { maxFileSize: number; maxOutputSize: number } {
    return {
      maxFileSize: this.config.filesystem?.maxFileSize || 10 * 1024 * 1024,
      maxOutputSize: this.config.filesystem?.maxOutputSize || 1024 * 1024,
    };
  }

  /**
   * Get security settings
   */
  getSecuritySettings() {
    return {
      enableAuditLogging: this.config.security?.enableAuditLogging ?? true,
      enableProcessMonitoring: this.config.security?.enableProcessMonitoring ?? true,
      maxProcessCount: this.config.security?.maxProcessCount ?? 10,
      maxMemoryUsage: this.config.security?.maxMemoryUsage ?? 512 * 1024 * 1024,
    };
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate timeouts
    if (
      this.config.execution?.defaultTimeout &&
      this.config.execution?.maxTimeout &&
      this.config.execution.defaultTimeout > this.config.execution.maxTimeout
    ) {
      errors.push('Default timeout cannot exceed max timeout');
    }

    // Validate tool timeouts
    const maxTimeout = this.config.execution?.maxTimeout || 300000;
    for (const [tool, timeout] of Object.entries(this.config.execution?.toolTimeouts || {})) {
      if (timeout > maxTimeout) {
        errors.push(`Tool ${tool} timeout exceeds maximum`);
      }
    }

    // Validate file sizes
    if (
      this.config.filesystem?.maxFileSize &&
      this.config.filesystem?.maxOutputSize &&
      this.config.filesystem.maxFileSize < this.config.filesystem.maxOutputSize
    ) {
      errors.push('Max file size cannot be less than max output size');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
