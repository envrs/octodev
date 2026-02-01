import { spawn } from 'child_process';
import { CommandValidator } from '../validators/command-validator';

export interface ShellExecutionOptions {
  timeout?: number; // milliseconds
  cwd?: string;
  env?: Record<string, string>;
  maxOutput?: number; // bytes
}

export interface ShellExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  truncated?: boolean;
  error?: string;
}

export class ShellOperations {
  private commandValidator: CommandValidator;
  private defaultTimeout: number;
  private maxOutput: number;

  constructor(validator: CommandValidator, defaultTimeout: number = 30000, maxOutput: number = 1024 * 1024) {
    this.commandValidator = validator;
    this.defaultTimeout = defaultTimeout;
    this.maxOutput = maxOutput;
  }

  /**
   * Executes a shell command with validation and timeout
   */
  async executeCommand(command: string, options: ShellExecutionOptions = {}): Promise<ShellExecutionResult> {
    try {
      // Validate command
      const validation = this.commandValidator.validateCommand(command);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Set timeout
      const timeout = options.timeout || this.defaultTimeout;

      // Execute command
      return await this.runCommand(command, {
        ...options,
        timeout
      });
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Internal method to run command with child_process
   */
  private runCommand(command: string, options: ShellExecutionOptions & { timeout: number }): Promise<ShellExecutionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let outputExceeded = false;
      const startTime = Date.now();

      try {
        // Parse command for shell execution
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

        const child = spawn(shell, shellArgs, {
          cwd: options.cwd || process.cwd(),
          env: {
            ...process.env,
            ...options.env
          },
          timeout: options.timeout,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle stdout
        child.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (stdout.length + chunk.length > this.maxOutput) {
            outputExceeded = true;
            stdout += chunk.substring(0, this.maxOutput - stdout.length);
            child.kill();
          } else {
            stdout += chunk;
          }
        });

        // Handle stderr
        child.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (stderr.length + chunk.length > this.maxOutput) {
            outputExceeded = true;
            stderr += chunk.substring(0, this.maxOutput - stderr.length);
            child.kill();
          } else {
            stderr += chunk;
          }
        });

        // Handle process exit
        child.on('exit', (code: number | null) => {
          const executionTime = Date.now() - startTime;

          resolve({
            success: code === 0 || code === null,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code || 0,
            truncated: outputExceeded
          });
        });

        // Handle process errors
        child.on('error', (error: Error) => {
          resolve({
            success: false,
            error: `Process error: ${error.message}`,
            stderr: error.message
          });
        });

        // Handle timeout
        if (options.timeout) {
          setTimeout(() => {
            try {
              child.kill('SIGTERM');
              resolve({
                success: false,
                error: `Command timed out after ${options.timeout}ms`,
                stderr: `Timeout: command exceeded ${options.timeout}ms limit`
              });
            } catch (e) {
              // Process already exited
            }
          }, options.timeout);
        }
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
  }

  /**
   * Validates if a command exists
   */
  async commandExists(command: string): Promise<boolean> {
    try {
      const validation = this.commandValidator.validateCommand(command);
      if (!validation.valid) {
        return false;
      }

      const result = await this.runCommand(
        process.platform === 'win32' ? `where ${command}` : `which ${command}`,
        { timeout: 5000 }
      );

      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Gets environment variables
   */
  getEnvironment(): Record<string, string | undefined> {
    return process.env as Record<string, string | undefined>;
  }

  /**
   * Gets current working directory
   */
  getCurrentWorkingDirectory(): string {
    return process.cwd();
  }
}
