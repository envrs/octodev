/**
 * Executor Service - Bridges TUI shell with SafeExecutor
 */

import { SafeExecutor } from '@/tools/executor';
import { ToolRegistry } from '@/tools/registry';
import { CompleteExecutionResult } from '@/types';
import { createLogger } from '@/utils/logger';
import { getErrorSuggestion } from '@/utils/custom-errors';

const logger = createLogger('executor-service');

export interface ExecutorServiceConfig {
  defaultTimeout?: number;
  allowedPaths?: string[];
  commandWhitelist?: string[];
}

export class ExecutorService {
  private executor: SafeExecutor;
  private registry: ToolRegistry;

  constructor(config: ExecutorServiceConfig = {}) {
    this.executor = new SafeExecutor({
      timeout: config.defaultTimeout || 30000,
      allowedPaths: config.allowedPaths || [process.cwd()],
      commandWhitelist: config.commandWhitelist
    });

    this.registry = new ToolRegistry();
    logger.debug({ config }, 'ExecutorService initialized');
  }

  /**
   * Execute a command from the shell
   */
  async executeCommand(
    input: string,
    sessionId: string,
    workingDir?: string
  ): Promise<{
    success: boolean;
    output: string;
    error?: string;
    suggestion?: string;
    truncated?: boolean;
  }> {
    try {
      logger.debug({ input, sessionId }, 'Executing command');

      // Parse command
      const [toolId, ...args] = input.trim().split(/\s+/);
      const command = `${toolId} ${args.join(' ')}`;

      // Execute via SafeExecutor
      const result = await this.executor.execute(
        toolId,
        command,
        {
          sessionId,
          workingDir: workingDir || process.cwd(),
          environment: 'production'
        }
      );

      return this.formatResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Command execution failed');

      return {
        success: false,
        output: '',
        error: message,
        suggestion: 'Check the command syntax or try "help" for available commands'
      };
    }
  }

  /**
   * Format execution result for display
   */
  private formatResult(result: CompleteExecutionResult): {
    success: boolean;
    output: string;
    error?: string;
    suggestion?: string;
    truncated?: boolean;
  } {
    if (result.success) {
      const output = this.formatOutput(result.data);
      return {
        success: true,
        output,
        truncated: result.output?.truncated
      };
    } else {
      const suggestion = result.metadata?.errorCode
        ? getErrorSuggestion(new Error(result.error) as any)
        : undefined;

      return {
        success: false,
        output: '',
        error: result.error,
        suggestion,
        truncated: result.output?.truncated
      };
    }
  }

  /**
   * Format different output types
   */
  private formatOutput(data: unknown): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        // Format array of files
        if (data.length > 0 && 'name' in data[0]) {
          return (data as any[])
            .map(item => `${item.type === 'directory' ? '[DIR]' : '[FILE]'} ${item.name} ${item.size ? `(${this.formatBytes(item.size)})` : ''}`)
            .join('\n');
        }
        return JSON.stringify(data, null, 2);
      }

      if ('stdout' in data) {
        // Shell execution result
        const shell = data as { stdout?: string; stderr?: string; exitCode?: number };
        let output = '';
        if (shell.stdout) output += shell.stdout;
        if (shell.stderr) output += (output ? '\n' : '') + `[STDERR] ${shell.stderr}`;
        return output;
      }

      // Generic object formatting
      return JSON.stringify(data, null, 2);
    }

    return String(data);
  }

  /**
   * Get available tools
   */
  getAvailableTools(): Array<{ id: string; name: string; description: string }> {
    return this.registry.getAllTools().map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description
    }));
  }

  /**
   * Get tool help
   */
  getToolHelp(toolId: string): string {
    const tool = this.registry.getTool(toolId);
    if (!tool) {
      return `Tool not found: ${toolId}`;
    }

    let help = `${tool.name} - ${tool.description}\n\n`;
    help += `Usage: ${toolId} [options]\n\n`;
    help += 'Parameters:\n';

    for (const param of tool.parameters) {
      const required = param.required ? ' (required)' : '';
      help += `  --${param.name}: ${param.type}${required}\n`;
      help += `    ${param.description}\n`;
    }

    if (tool.examples && tool.examples.length > 0) {
      help += '\nExamples:\n';
      for (const example of tool.examples) {
        help += `  ${example}\n`;
      }
    }

    return help;
  }

  /**
   * Parse built-in commands
   */
  async handleBuiltInCommand(
    input: string,
    sessionId: string
  ): Promise<{ handled: boolean; output?: string }> {
    const [cmd, ...args] = input.trim().split(/\s+/);

    switch (cmd.toLowerCase()) {
      case 'help':
        return {
          handled: true,
          output: this.getHelpMessage()
        };

      case 'tools':
        return {
          handled: true,
          output: this.getToolsListMessage()
        };

      case 'clear':
        return { handled: true, output: '' };

      case 'status':
        return {
          handled: true,
          output: `Session: ${sessionId}\nWorking Dir: ${process.cwd()}\nActive Processes: ${this.getProcessCount()}`
        };

      case 'tool-help':
        if (args.length === 0) {
          return { handled: true, output: 'Usage: tool-help <tool-id>' };
        }
        return {
          handled: true,
          output: this.getToolHelp(args[0])
        };

      default:
        return { handled: false };
    }
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return `Available Commands:
  help              - Show this message
  tools             - List available tools
  tool-help <id>    - Show help for a specific tool
  clear             - Clear the terminal
  status            - Show current session status
  exit/quit         - Exit the shell

Tool Usage:
  <tool-id> [args]  - Execute a tool with arguments

Examples:
  file-read /path/to/file
  list-dir .
  shell-exec ls -la
`;
  }

  /**
   * Get tools list message
   */
  private getToolsListMessage(): string {
    const tools = this.getAvailableTools();
    let output = 'Available Tools:\n\n';

    for (const tool of tools) {
      output += `${tool.id}\n  ${tool.description}\n\n`;
    }

    return output;
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get process count
   */
  private getProcessCount(): number {
    // Placeholder - would integrate with ProcessManager
    return 0;
  }

  /**
   * Set tool timeout
   */
  setToolTimeout(toolId: string, timeout: number): void {
    this.executor.setToolTimeout(toolId, timeout);
    logger.info({ toolId, timeout }, 'Tool timeout updated');
  }

  /**
   * Add allowed directory
   */
  addAllowedDirectory(dir: string): void {
    this.executor.addAllowedDirectory(dir);
    logger.info({ dir }, 'Allowed directory added');
  }

  /**
   * Add command to whitelist
   */
  addCommandToWhitelist(command: string): void {
    this.executor.addCommandToWhitelist(command);
    logger.info({ command }, 'Command added to whitelist');
  }
}

// Singleton instance
let executorService: ExecutorService | null = null;

export function getExecutorService(config?: ExecutorServiceConfig): ExecutorService {
  if (!executorService) {
    executorService = new ExecutorService(config);
  }
  return executorService;
}
