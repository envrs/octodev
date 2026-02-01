/**
 * Sandbox Manager - orchestrates safe code execution
 * Handles execution queuing, resource limits, and lifecycle management
 */

import { createScopedLogger } from '~/utils/logger';
import type {
  SandboxConfig,
  ExecutionLog,
  SandboxSession,
  ExecutionSnapshot,
  FileChange,
} from '~/types/sandbox';
import { SANDBOX_LIMITS } from '~/types/sandbox';
import { CodeValidator, validateCode, requiresApproval } from './code-validator';

const logger = createScopedLogger('SandboxManager');

interface QueuedExecution {
  id: string;
  config: SandboxConfig;
  code: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  resolve: (log: ExecutionLog) => void;
  reject: (error: Error) => void;
}

export class SandboxManager {
  private sessions: Map<string, SandboxSession> = new Map();
  private executionQueue: QueuedExecution[] = [];
  private activeExecutions: Set<string> = new Set();
  private fileSnapshots: Map<string, ExecutionSnapshot> = new Map();

  constructor() {
    this.startQueueProcessor();
  }

  /**
   * Create a new sandbox session
   */
  createSession(config: SandboxConfig): SandboxSession {
    const session: SandboxSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sandboxId: config.id,
      createdAt: Date.now(),
      status: 'initialized',
      executionLogs: [],
      approvalRequired: false,
    };

    this.sessions.set(session.id, session);
    logger.debug(`Session created: ${session.id}`);

    return session;
  }

  /**
   * Queue code for execution
   */
  async executeCode(
    sessionId: string,
    config: SandboxConfig,
    code: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<ExecutionLog> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (this.activeExecutions.size >= SANDBOX_LIMITS.MAX_CONCURRENT_EXECUTIONS) {
      logger.warn('Max concurrent executions reached, queuing...');
    }

    return new Promise((resolve, reject) => {
      const execution: QueuedExecution = {
        id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        config,
        code,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // Insert by priority
      const insertIndex = this.executionQueue.findIndex((e) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[e.priority] < priorityOrder[priority];
      });

      if (insertIndex === -1) {
        this.executionQueue.push(execution);
      } else {
        this.executionQueue.splice(insertIndex, 0, execution);
      }

      logger.debug(
        `Execution queued: ${execution.id} (Priority: ${priority}, Queue length: ${this.executionQueue.length})`,
      );
    });
  }

  /**
   * Process execution queue
   */
  private async startQueueProcessor() {
    // Process queue every 100ms
    setInterval(() => {
      if (this.executionQueue.length > 0 && this.activeExecutions.size < SANDBOX_LIMITS.MAX_CONCURRENT_EXECUTIONS) {
        const execution = this.executionQueue.shift();

        if (execution) {
          this.processExecution(execution).catch((error) => {
            logger.error('Queue processor error:', error);
          });
        }
      }
    }, 100);
  }

  /**
   * Process a single execution
   */
  private async processExecution(execution: QueuedExecution) {
    const { id, config, code } = execution;

    try {
      this.activeExecutions.add(id);

      // Create execution log
      const log = await this.runExecution(config, code);

      // Update session
      const session = this.sessions.get(config.id);
      if (session) {
        session.executionLogs.push(log);
        session.status = log.status === 'error' || log.status === 'timeout' ? 'failed' : 'completed';
      }

      execution.resolve(log);
    } catch (error) {
      execution.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeExecutions.delete(id);
    }
  }

  /**
   * Run code execution with validation and timeout
   */
  private async runExecution(config: SandboxConfig, code: string): Promise<ExecutionLog> {
    const startTime = Date.now();
    const logId = `log-${startTime}-${Math.random().toString(36).substr(2, 9)}`;

    const executionLog: ExecutionLog = {
      id: logId,
      sandboxId: config.id,
      executionType: config.executionType,
      language: config.language,
      code,
      startTime,
      status: 'pending',
      output: '',
      errors: '',
      warnings: [],
      fileOperations: [],
      networkRequests: [],
    };

    try {
      // Step 1: Validate code
      logger.debug(`Validating code for ${logId}`);
      const validationResult = validateCode(code, config.validationLevel);
      executionLog.validationResult = validationResult;

      if (!validationResult.isValid) {
        executionLog.status = 'error';
        executionLog.errors = `Code validation failed:\n${new CodeValidator(code, config.validationLevel).getSummary(validationResult)}`;
        executionLog.endTime = Date.now();
        executionLog.duration = executionLog.endTime - startTime;
        return executionLog;
      }

      // Record warnings
      executionLog.warnings = validationResult.issues.map((i) => i.message);

      // Step 2: Check if approval is required
      if (requiresApproval(validationResult)) {
        const session = this.sessions.get(config.id);
        if (session) {
          session.approvalRequired = true;
        }

        executionLog.status = 'pending';
        executionLog.output = 'Waiting for approval...';
        executionLog.endTime = Date.now();
        executionLog.duration = executionLog.endTime - startTime;

        logger.debug(`Execution ${logId} requires approval`);
        return executionLog;
      }

      // Step 3: Create file snapshot before execution
      logger.debug(`Creating snapshot for ${logId}`);
      const beforeSnapshot = await this.createSnapshot(config.workspaceId || 'default');

      // Step 4: Execute code (simulated - would connect to WebContainer)
      logger.debug(`Executing code for ${logId}`);
      const executionResult = await this.simulateExecution(config, code);

      executionLog.status = executionResult.status;
      executionLog.output = executionResult.output;
      executionLog.errors = executionResult.errors;
      executionLog.exitCode = executionResult.exitCode;

      // Step 5: Create snapshot after execution and compute changes
      logger.debug(`Creating post-execution snapshot for ${logId}`);
      const afterSnapshot = await this.createSnapshot(config.workspaceId || 'default');

      const changes = this.computeChanges(beforeSnapshot, afterSnapshot);
      const snapshot: ExecutionSnapshot = {
        beforeState: beforeSnapshot,
        afterState: afterSnapshot,
        changes,
      };

      executionLog.fileOperations = changes.map((c) => ({
        timestamp: Date.now(),
        operation: c.type === 'created' ? 'write' : c.type === 'modified' ? 'write' : 'delete',
        path: c.path,
        size: c.size,
      }));

      this.fileSnapshots.set(logId, snapshot);
    } catch (error) {
      executionLog.status = 'error';
      executionLog.errors = error instanceof Error ? error.message : String(error);
    } finally {
      executionLog.endTime = Date.now();
      executionLog.duration = executionLog.endTime - startTime;
    }

    return executionLog;
  }

  /**
   * Simulate code execution (would integrate with WebContainer)
   */
  private async simulateExecution(
    config: SandboxConfig,
    code: string,
  ): Promise<{
    status: ExecutionLog['status'];
    output: string;
    errors: string;
    exitCode?: number;
  }> {
    // This is a placeholder - would be replaced with actual WebContainer execution
    return new Promise((resolve) => {
      const timeout = config.timeout || SANDBOX_LIMITS.TIMEOUT_MS;

      const timeoutId = setTimeout(() => {
        resolve({
          status: 'timeout',
          output: '',
          errors: `Execution timeout after ${timeout}ms`,
          exitCode: 124,
        });
      }, timeout);

      try {
        // Simulate execution with try-catch for common JS errors
        eval(code);

        clearTimeout(timeoutId);
        resolve({
          status: 'success',
          output: 'Execution completed',
          errors: '',
          exitCode: 0,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          status: 'error',
          output: '',
          errors: error instanceof Error ? error.message : String(error),
          exitCode: 1,
        });
      }
    });
  }

  /**
   * Create filesystem snapshot
   */
  private async createSnapshot(workspaceId: string): Promise<ExecutionSnapshot['beforeState']> {
    // Placeholder - would read actual filesystem from WebContainer
    return {
      files: {},
      timestamp: Date.now(),
    };
  }

  /**
   * Compute file changes between snapshots
   */
  private computeChanges(before: ExecutionSnapshot['beforeState'], after: ExecutionSnapshot['afterState']): FileChange[] {
    const changes: FileChange[] = [];

    // Find modified and created files
    Object.keys(after.files).forEach((path) => {
      const afterContent = after.files[path];
      const beforeContent = before.files[path];

      if (!beforeContent) {
        changes.push({
          path,
          type: 'created',
          after: afterContent,
          size: afterContent.length,
        });
      } else if (beforeContent !== afterContent) {
        changes.push({
          path,
          type: 'modified',
          before: beforeContent,
          after: afterContent,
          size: afterContent.length,
        });
      }
    });

    // Find deleted files
    Object.keys(before.files).forEach((path) => {
      if (!after.files[path]) {
        changes.push({
          path,
          type: 'deleted',
          before: before.files[path],
          size: 0,
        });
      }
    });

    return changes;
  }

  /**
   * Approve pending execution
   */
  approveExecution(sessionId: string, approvedBy: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.approvalRequired = false;
    session.approvedBy = approvedBy;
    session.approvalTime = Date.now();

    logger.debug(`Execution approved for session: ${sessionId}`);
  }

  /**
   * Terminate session
   */
  terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'terminated';
    session.endedAt = Date.now();

    logger.debug(`Session terminated: ${sessionId}`);
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): SandboxSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get execution log
   */
  getExecutionLog(logId: string): ExecutionLog | undefined {
    // This would typically query from a database
    return undefined;
  }

  /**
   * Get file snapshot
   */
  getSnapshot(logId: string): ExecutionSnapshot | undefined {
    return this.fileSnapshots.get(logId);
  }

  /**
   * Rollback to pre-execution state
   */
  async rollbackExecution(logId: string): Promise<void> {
    const snapshot = this.fileSnapshots.get(logId);

    if (!snapshot) {
      throw new Error(`Snapshot not found for execution: ${logId}`);
    }

    // Would restore files from snapshot.beforeState
    logger.debug(`Rolling back execution: ${logId}`);

    this.fileSnapshots.delete(logId);
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size,
      maxConcurrent: SANDBOX_LIMITS.MAX_CONCURRENT_EXECUTIONS,
    };
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(ageMs: number = 3600000): void {
    // 1 hour default
    const cutoffTime = Date.now() - ageMs;
    let removed = 0;

    this.sessions.forEach((session, id) => {
      if (session.endedAt && session.endedAt < cutoffTime) {
        this.sessions.delete(id);
        removed++;
      }
    });

    logger.debug(`Cleaned up ${removed} old sessions`);
  }
}

/**
 * Global sandbox manager instance
 */
let globalSandboxManager: SandboxManager | null = null;

export function getSandboxManager(): SandboxManager {
  if (!globalSandboxManager) {
    globalSandboxManager = new SandboxManager();
  }

  return globalSandboxManager;
}
