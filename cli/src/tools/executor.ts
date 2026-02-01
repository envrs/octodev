/**
 * Enhanced SafeExecutor - Real sandboxed tool execution with timeouts
 */

import { ToolExecutionContext, ToolExecutionResult, CompleteExecutionResult } from "@/types";
import { createLogger } from "@/utils/logger";
import { PathValidator } from "./validators/path-validator";
import { CommandValidator } from "./validators/command-validator";
import { FileOperations } from "./operations/file-operations";
import { ShellOperations } from "./operations/shell-operations";
import {
  ToolExecutionError,
  TimeoutError,
  PermissionError,
  ValidationError,
  getErrorSuggestion
} from "@/utils/custom-errors";

const logger = createLogger("safe-executor");

/**
 * Sandbox options for execution environment
 */
export interface SandboxOptions {
  timeout?: number; // milliseconds
  maxMemory?: number; // bytes
  allowedPaths?: string[];
  commandWhitelist?: string[];
  maxFileSize?: number;
  maxOutputSize?: number;
  allowSymlinks?: boolean;
}

/**
 * Default sandbox options (restricted)
 */
export const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  timeout: 30000, // 30 seconds
  maxMemory: 512 * 1024 * 1024, // 512MB
  allowedPaths: [process.cwd()],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxOutputSize: 1024 * 1024, // 1MB
  allowSymlinks: false,
};

/**
 * Tool timeout overrides (can specify per-tool timeouts)
 */
interface ToolTimeoutOverrides {
  [toolId: string]: number;
}

/**
 * Enhanced SafeExecutor with real execution capabilities
 */
export class SafeExecutor {
  private options: SandboxOptions;
  private pathValidator: PathValidator;
  private commandValidator: CommandValidator;
  private fileOperations: FileOperations;
  private shellOperations: ShellOperations;
  private timeoutOverrides: ToolTimeoutOverrides;
  private executionLog: Map<string, CompleteExecutionResult[]>;

  constructor(options: SandboxOptions = {}) {
    this.options = { ...DEFAULT_SANDBOX_OPTIONS, ...options };

    // Initialize validators and operations
    this.pathValidator = new PathValidator({
      allowedDirectories: this.options.allowedPaths,
      allowSymlinks: this.options.allowSymlinks
    });

    this.commandValidator = new CommandValidator({
      whitelist: this.options.commandWhitelist
    });

    this.fileOperations = new FileOperations(this.pathValidator, {
      maxFileSize: this.options.maxFileSize,
      maxOutputSize: this.options.maxOutputSize
    });

    this.shellOperations = new ShellOperations(
      this.commandValidator,
      this.options.timeout!,
      this.options.maxOutputSize
    );

    this.timeoutOverrides = {};
    this.executionLog = new Map();

    logger.debug({ options: this.options }, "SafeExecutor initialized");
  }

  /**
   * Execute a tool with validation and timeout enforcement
   */
  async execute(
    toolId: string,
    command: string,
    context: ToolExecutionContext
  ): Promise<CompleteExecutionResult> {
    const startTime = Date.now();

    try {
      logger.debug({ toolId, command, context }, "Execution started");

      // Validate context
      this.validateContext(context);

      // Get timeout (use override if available)
      const timeout = this.timeoutOverrides[toolId] || this.options.timeout || 30000;

      // Execute with timeout wrapper
      const result = await this.executeWithTimeout(
        () => this.executeCommand(toolId, command, context),
        timeout,
        command
      );

      const duration = Date.now() - startTime;

      const completeResult: CompleteExecutionResult = {
        ...result,
        executionTime: duration,
        metadata: {
          executedAt: new Date(),
          duration,
          status: result.success ? 'success' : 'failure'
        }
      };

      // Log execution
      this.logExecution(toolId, completeResult);

      logger.info(
        { toolId, duration, success: result.success },
        "Execution completed"
      );

      return completeResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle error
      const errorResult = this.handleExecutionError(error, duration);
      this.logExecution(toolId, errorResult);

      return errorResult;
    }
  }

  /**
   * Internal command execution logic
   */
  private async executeCommand(
    toolId: string,
    command: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Parse command to determine tool type
    const [tool, ...args] = command.split(' ');

    switch (tool) {
      case 'file-read':
        return await this.executeFileRead(args.join(' '));
      case 'file-write':
        return await this.executeFileWrite(args);
      case 'list-dir':
        return await this.executeListDir(args.join(' '));
      case 'file-stat':
        return await this.executeFileStat(args.join(' '));
      case 'file-copy':
        return await this.executeFileCopy(args);
      case 'shell-exec':
        return await this.executeShellExec(args.join(' '), context);
      default:
        throw new ValidationError('tool', `Unknown tool: ${tool}`);
    }
  }

  /**
   * Execute file-read command
   */
  private async executeFileRead(path: string): Promise<ToolExecutionResult> {
    if (!path) {
      throw new ValidationError('path', 'Path is required for file-read');
    }

    const result = await this.fileOperations.readFile(path);

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute file-write command
   */
  private async executeFileWrite(args: string[]): Promise<ToolExecutionResult> {
    if (args.length < 2) {
      throw new ValidationError('args', 'file-write requires path and content');
    }

    const [path, ...contentParts] = args;
    const content = contentParts.join(' ');

    const result = await this.fileOperations.writeFile(path, content, { backup: true });

    return {
      success: result.success,
      data: result.path,
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute list-dir command
   */
  private async executeListDir(path: string): Promise<ToolExecutionResult> {
    if (!path) {
      throw new ValidationError('path', 'Path is required for list-dir');
    }

    const result = await this.fileOperations.listDirectory(path);

    return {
      success: result.success,
      data: result.files,
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute file-stat command
   */
  private async executeFileStat(path: string): Promise<ToolExecutionResult> {
    if (!path) {
      throw new ValidationError('path', 'Path is required for file-stat');
    }

    const result = await this.fileOperations.getFileStats(path);

    return {
      success: result.success,
      data: result.stats,
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute file-copy command
   */
  private async executeFileCopy(args: string[]): Promise<ToolExecutionResult> {
    if (args.length < 2) {
      throw new ValidationError('args', 'file-copy requires source and destination');
    }

    const [source, dest, ...opts] = args;
    const overwrite = opts.includes('--overwrite');

    const result = await this.fileOperations.copyFile(source, dest, { overwrite });

    return {
      success: result.success,
      data: result.path,
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute shell-exec command
   */
  private async executeShellExec(
    shellCommand: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (!shellCommand) {
      throw new ValidationError('command', 'Shell command is required');
    }

    const result = await this.shellOperations.executeCommand(shellCommand, {
      cwd: context.workingDir || process.cwd(),
      timeout: context.timeout || this.options.timeout
    });

    return {
      success: result.success,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      },
      error: result.error,
      executionTime: 0
    };
  }

  /**
   * Execute with timeout enforcement
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    command: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(timeout, command)),
          timeout
        )
      )
    ]);
  }

  /**
   * Validate execution context
   */
  private validateContext(context: ToolExecutionContext): void {
    if (!context.sessionId) {
      throw new ValidationError('context', 'Session ID is required');
    }
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError(error: unknown, duration: number): CompleteExecutionResult {
    if (error instanceof ToolExecutionError) {
      return {
        success: false,
        error: error.message,
        executionTime: duration,
        metadata: {
          executedAt: new Date(),
          duration,
          status: 'failure',
          errorCode: error.code
        }
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
      executionTime: duration,
      metadata: {
        executedAt: new Date(),
        duration,
        status: 'failure'
      }
    };
  }

  /**
   * Log execution for audit trail
   */
  private logExecution(toolId: string, result: CompleteExecutionResult): void {
    if (!this.executionLog.has(toolId)) {
      this.executionLog.set(toolId, []);
    }

    const log = this.executionLog.get(toolId)!;
    log.push(result);

    // Keep last 100 executions per tool
    if (log.length > 100) {
      log.shift();
    }
  }

  /**
   * Set timeout override for a specific tool
   */
  setToolTimeout(toolId: string, timeout: number): void {
    if (timeout > 0) {
      this.timeoutOverrides[toolId] = timeout;
    }
  }

  /**
   * Get execution log for a tool
   */
  getExecutionLog(toolId: string): CompleteExecutionResult[] {
    return this.executionLog.get(toolId) || [];
  }

  /**
   * Add allowed directory
   */
  addAllowedDirectory(dir: string): void {
    this.pathValidator.addAllowedDirectory(dir);
  }

  /**
   * Add command to whitelist
   */
  addCommandToWhitelist(command: string): void {
    this.commandValidator.addToWhitelist(command);
  }

  /**
   * Get current sandbox options
   */
  getSandboxOptions(): SandboxOptions {
    return { ...this.options };
  }
}
