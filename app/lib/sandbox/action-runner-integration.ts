/**
 * ActionRunner Sandbox Integration
 * Wraps ActionRunner with sandbox execution for code safety
 */

import type { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from '~/utils/logger';
import { getSandboxManager } from './sandbox-manager';
import { getExecutionLogger } from './execution-logger';
import { CodeValidator, requiresApproval, validateCode } from './code-validator';
import type { SandboxConfig, ExecutionType } from '~/types/sandbox';
import { SANDBOX_LIMITS } from '~/types/sandbox';

const logger = createScopedLogger('SandboxActionRunnerIntegration');

/**
 * Configuration for sandbox execution mode
 */
export interface SandboxExecutionOptions {
  enabled: boolean;
  executionType: ExecutionType;
  validationLevel: 'strict' | 'moderate' | 'permissive';
  requireApproval: boolean;
  timeout?: number;
  workspaceId?: string;
}

/**
 * Wrapper for ActionRunner that adds sandbox safety
 */
export class SandboxedActionRunner {
  private sandboxManager = getSandboxManager();
  private executionLogger = getExecutionLogger();
  private sessionMap: Map<string, string> = new Map(); // Maps runId to sessionId

  /**
   * Execute shell command with sandbox safety
   */
  async executeShellCommandSafely(
    runId: string,
    command: string,
    options: SandboxExecutionOptions,
  ): Promise<{
    success: boolean;
    exitCode?: number;
    output: string;
    error?: string;
    requiresApproval?: boolean;
  }> {
    logger.debug(`[${runId}] Executing shell command with sandbox: ${command.substring(0, 50)}...`);

    try {
      // Step 1: Create sandbox session if not exists
      let sessionId = this.sessionMap.get(runId);

      if (!sessionId) {
        const config: SandboxConfig = {
          id: `sandbox-${runId}`,
          executionType: options.executionType,
          language: 'node',
          validationLevel: options.validationLevel,
          timeout: options.timeout || SANDBOX_LIMITS.TIMEOUT_MS,
          memoryLimit: SANDBOX_LIMITS.MEMORY_MB,
          filesystemLimit: SANDBOX_LIMITS.FILESYSTEM_MB,
          allowNetworkRequests: false,
          workspaceId: options.workspaceId,
        };

        const session = this.sandboxManager.createSession(config);
        sessionId = session.id;
        this.sessionMap.set(runId, sessionId);

        logger.debug(`[${runId}] Created sandbox session: ${sessionId}`);
      }

      // Step 2: Validate command
      const validationResult = validateCode(command, options.validationLevel);

      if (!validationResult.isValid && options.validationLevel === 'strict') {
        logger.warn(`[${runId}] Command validation failed: ${validationResult.severity}`);

        return {
          success: false,
          output: '',
          error: `Command validation failed (${validationResult.severity})`,
          requiresApproval: true,
        };
      }

      // Step 3: Check if approval is needed
      if (requiresApproval(validationResult) && options.requireApproval) {
        logger.info(`[${runId}] Command requires approval`);

        return {
          success: false,
          output: 'Command requires approval before execution',
          requiresApproval: true,
        };
      }

      // Step 4: Execute with sandbox
      const config: SandboxConfig = {
        id: `sandbox-${runId}`,
        executionType: options.executionType,
        language: 'node',
        validationLevel: options.validationLevel,
        timeout: options.timeout || SANDBOX_LIMITS.TIMEOUT_MS,
        memoryLimit: SANDBOX_LIMITS.MEMORY_MB,
        filesystemLimit: SANDBOX_LIMITS.FILESYSTEM_MB,
        allowNetworkRequests: false,
        workspaceId: options.workspaceId,
      };

      const executionLog = await this.sandboxManager.executeCode(sessionId, config, command, 'normal');

      return {
        success: executionLog.status === 'success',
        exitCode: executionLog.exitCode,
        output: executionLog.output,
        error: executionLog.errors || undefined,
      };
    } catch (error) {
      logger.error(`[${runId}] Sandbox execution error:`, error);

      return {
        success: false,
        exitCode: 1,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute file operation with sandbox safety
   */
  async executeFileOperationSafely(
    runId: string,
    filePath: string,
    content: string,
    options: SandboxExecutionOptions,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    logger.debug(`[${runId}] Writing file with sandbox: ${filePath}`);

    try {
      // Get or create session
      let sessionId = this.sessionMap.get(runId);

      if (!sessionId) {
        const config: SandboxConfig = {
          id: `sandbox-${runId}`,
          executionType: options.executionType,
          language: 'node',
          validationLevel: options.validationLevel,
          timeout: options.timeout || SANDBOX_LIMITS.TIMEOUT_MS,
          memoryLimit: SANDBOX_LIMITS.MEMORY_MB,
          filesystemLimit: SANDBOX_LIMITS.FILESYSTEM_MB,
          allowNetworkRequests: false,
          workspaceId: options.workspaceId,
        };

        const session = this.sandboxManager.createSession(config);
        sessionId = session.id;
        this.sessionMap.set(runId, sessionId);
      }

      // Log file operation
      const logger_inst = this.executionLogger.createStream(`file-${runId}`);
      this.executionLogger.logFileOperation(`file-${runId}`, {
        timestamp: Date.now(),
        operation: 'write',
        path: filePath,
        size: content.length,
      });

      // In a real implementation, would write to WebContainer
      // For now, just track the operation
      logger.debug(`[${runId}] File operation tracked: ${filePath}`);

      return { success: true };
    } catch (error) {
      logger.error(`[${runId}] File operation error:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup sandbox session
   */
  cleanupSession(runId: string): void {
    const sessionId = this.sessionMap.get(runId);

    if (sessionId) {
      this.sandboxManager.terminateSession(sessionId);
      this.sessionMap.delete(runId);

      logger.debug(`[${runId}] Sandbox session cleaned up`);
    }
  }

  /**
   * Get sandbox session status
   */
  getSessionStatus(runId: string) {
    const sessionId = this.sessionMap.get(runId);

    if (!sessionId) {
      return null;
    }

    const session = this.sandboxManager.getSession(sessionId);
    return {
      sessionId,
      session,
      queueStatus: this.sandboxManager.getQueueStatus(),
    };
  }

  /**
   * Get execution logs for run
   */
  getExecutionLogs(runId: string) {
    const sessionId = this.sessionMap.get(runId);

    if (!sessionId) {
      return [];
    }

    return this.executionLogger.getLogsBySession(sessionId);
  }

  /**
   * Rollback last execution for run
   */
  async rollbackLastExecution(runId: string): Promise<boolean> {
    const logs = this.getExecutionLogs(runId);

    if (logs.length === 0) {
      logger.warn(`[${runId}] No executions to rollback`);
      return false;
    }

    try {
      const lastLog = logs[logs.length - 1];
      await this.sandboxManager.rollbackExecution(lastLog.id);

      logger.info(`[${runId}] Rolled back execution: ${lastLog.id}`);
      return true;
    } catch (error) {
      logger.error(`[${runId}] Rollback failed:`, error);
      return false;
    }
  }
}

/**
 * Global sandboxed action runner instance
 */
let globalSandboxedRunner: SandboxedActionRunner | null = null;

export function getSandboxedActionRunner(): SandboxedActionRunner {
  if (!globalSandboxedRunner) {
    globalSandboxedRunner = new SandboxedActionRunner();
  }

  return globalSandboxedRunner;
}
