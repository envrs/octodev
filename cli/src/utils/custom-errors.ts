/**
 * Custom error types for tool execution
 */

export class ToolExecutionError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

export class TimeoutError extends ToolExecutionError {
  constructor(timeout: number, command?: string) {
    super(
      'TIMEOUT',
      `Operation timed out after ${timeout}ms${command ? `: ${command}` : ''}`,
      { timeout, command }
    );
    this.name = 'TimeoutError';
  }
}

export class PermissionError extends ToolExecutionError {
  constructor(path: string, operation: string) {
    super(
      'PERMISSION_DENIED',
      `Permission denied for ${operation} on: ${path}`,
      { path, operation }
    );
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends ToolExecutionError {
  constructor(path: string, type: 'file' | 'directory' | 'command' = 'file') {
    super(
      'NOT_FOUND',
      `${type.charAt(0).toUpperCase() + type.slice(1)} not found: ${path}`,
      { path, type }
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ToolExecutionError {
  constructor(field: string, reason: string) {
    super(
      'VALIDATION_FAILED',
      `Validation failed for ${field}: ${reason}`,
      { field, reason }
    );
    this.name = 'ValidationError';
  }
}

export class CommandNotWhitelistedError extends ToolExecutionError {
  constructor(command: string, allowedCommands: string[]) {
    super(
      'COMMAND_NOT_WHITELISTED',
      `Command not in whitelist: ${command}`,
      { command, allowedCommands: allowedCommands.slice(0, 10) }
    );
    this.name = 'CommandNotWhitelistedError';
  }
}

export class PathTraversalError extends ToolExecutionError {
  constructor(path: string) {
    super(
      'PATH_TRAVERSAL_ATTEMPT',
      `Potential path traversal attempt detected: ${path}`,
      { path }
    );
    this.name = 'PathTraversalError';
  }
}

/**
 * Error recovery suggestions
 */
export function getErrorSuggestion(error: ToolExecutionError): string {
  switch (error.code) {
    case 'TIMEOUT':
      return 'The operation took too long. Try running a simpler command or increase the timeout.';
    case 'PERMISSION_DENIED':
      return 'Check your file permissions or try with a directory you have access to.';
    case 'NOT_FOUND':
      return 'The file or command was not found. Check the path or command name.';
    case 'VALIDATION_FAILED':
      return 'The input validation failed. Check your command syntax and parameters.';
    case 'COMMAND_NOT_WHITELISTED':
      return 'This command is not allowed for security reasons.';
    case 'PATH_TRAVERSAL_ATTEMPT':
      return 'Path access denied for security reasons.';
    default:
      return 'An error occurred during execution. Check the error details.';
  }
}
