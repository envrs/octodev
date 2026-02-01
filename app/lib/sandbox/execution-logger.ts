/**
 * Execution Logger - captures and manages execution logs
 * Provides real-time log streaming and historical queries
 */

import { createScopedLogger } from '~/utils/logger';
import type { ExecutionLog, FileOperation, NetworkRequest } from '~/types/sandbox';
import { atom, map, type WritableAtom } from 'nanostores';

const logger = createScopedLogger('ExecutionLogger');

interface LogStream {
  id: string;
  listeners: Set<(chunk: string) => void>;
  isActive: boolean;
}

export class ExecutionLogger {
  private logs: Map<string, ExecutionLog> = new Map();
  private streams: Map<string, LogStream> = new Map();
  private logBuffer: Map<string, string[]> = new Map();
  private fileOpsBuffer: Map<string, FileOperation[]> = new Map();
  private networkReqsBuffer: Map<string, NetworkRequest[]> = new Map();

  // Nanostores for reactive updates
  logsStore: WritableAtom<Record<string, ExecutionLog>> = map({});
  streamsStore: WritableAtom<Record<string, boolean>> = map({});

  constructor() {
    // Auto-cleanup old logs every 5 minutes
    setInterval(() => this.cleanupOldLogs(), 5 * 60 * 1000);
  }

  /**
   * Create a new log stream for real-time output
   */
  createStream(logId: string): LogStream {
    const stream: LogStream = {
      id: logId,
      listeners: new Set(),
      isActive: true,
    };

    this.streams.set(logId, stream);
    this.logBuffer.set(logId, []);
    this.fileOpsBuffer.set(logId, []);
    this.networkReqsBuffer.set(logId, []);
    this.streamsStore.setKey(logId, true);

    logger.debug(`Stream created: ${logId}`);

    return stream;
  }

  /**
   * Write to log stream
   */
  write(logId: string, chunk: string): void {
    const stream = this.streams.get(logId);

    if (!stream) {
      logger.warn(`Stream not found: ${logId}`);
      return;
    }

    const buffer = this.logBuffer.get(logId) || [];
    buffer.push(chunk);
    this.logBuffer.set(logId, buffer);

    // Broadcast to all listeners
    stream.listeners.forEach((listener) => {
      try {
        listener(chunk);
      } catch (error) {
        logger.error('Error in log listener:', error);
      }
    });
  }

  /**
   * Write error to log
   */
  writeError(logId: string, error: string): void {
    this.write(logId, `[ERROR] ${error}\n`);
  }

  /**
   * Write warning to log
   */
  writeWarning(logId: string, warning: string): void {
    this.write(logId, `[WARNING] ${warning}\n`);
  }

  /**
   * Write info to log
   */
  writeInfo(logId: string, info: string): void {
    this.write(logId, `[INFO] ${info}\n`);
  }

  /**
   * Log file operation
   */
  logFileOperation(logId: string, operation: FileOperation): void {
    const ops = this.fileOpsBuffer.get(logId) || [];
    ops.push(operation);
    this.fileOpsBuffer.set(logId, ops);

    const timestamp = new Date(operation.timestamp).toISOString();
    const sizeStr = operation.size ? ` (${operation.size} bytes)` : '';
    this.write(logId, `[FILE] ${operation.operation.toUpperCase()} ${operation.path}${sizeStr} @ ${timestamp}\n`);
  }

  /**
   * Log network request
   */
  logNetworkRequest(logId: string, request: NetworkRequest): void {
    const reqs = this.networkReqsBuffer.get(logId) || [];
    reqs.push(request);
    this.networkReqsBuffer.set(logId, reqs);

    const timestamp = new Date(request.timestamp).toISOString();
    const statusStr = request.status ? ` [${request.status}]` : '';
    const blockedStr = request.blocked ? ' [BLOCKED]' : '';
    const reason = request.reason ? ` - ${request.reason}` : '';

    this.write(logId, `[NETWORK] ${request.method} ${request.url}${statusStr}${blockedStr}${reason} @ ${timestamp}\n`);
  }

  /**
   * Subscribe to log stream
   */
  subscribe(logId: string, listener: (chunk: string) => void): () => void {
    const stream = this.streams.get(logId);

    if (!stream) {
      logger.warn(`Cannot subscribe: stream not found ${logId}`);
      return () => {};
    }

    stream.listeners.add(listener);

    // Send buffered content immediately
    const buffer = this.logBuffer.get(logId) || [];
    buffer.forEach((chunk) => {
      try {
        listener(chunk);
      } catch (error) {
        logger.error('Error in subscription listener:', error);
      }
    });

    // Return unsubscribe function
    return () => {
      stream.listeners.delete(listener);
    };
  }

  /**
   * Finalize execution log
   */
  finalize(log: ExecutionLog): void {
    // Merge buffered content into log
    const buffer = this.logBuffer.get(log.id) || [];
    const fileOps = this.fileOpsBuffer.get(log.id) || [];
    const networkReqs = this.networkReqsBuffer.get(log.id) || [];

    log.output = buffer.join('');
    log.fileOperations = fileOps;
    log.networkRequests = networkReqs;

    this.logs.set(log.id, log);
    this.logsStore.setKey(log.id, log);

    // Close stream
    const stream = this.streams.get(log.id);
    if (stream) {
      stream.isActive = false;
      this.streamsStore.setKey(log.id, false);
    }

    logger.debug(`Log finalized: ${log.id} (${buffer.length} bytes, ${fileOps.length} file ops, ${networkReqs.length} network reqs)`);

    // Cleanup buffers
    this.logBuffer.delete(log.id);
    this.fileOpsBuffer.delete(log.id);
    this.networkReqsBuffer.delete(log.id);
  }

  /**
   * Get log by ID
   */
  getLog(logId: string): ExecutionLog | undefined {
    return this.logs.get(logId);
  }

  /**
   * Get all logs
   */
  getAllLogs(): ExecutionLog[] {
    return Array.from(this.logs.values());
  }

  /**
   * Get logs by session
   */
  getLogsBySession(sessionId: string): ExecutionLog[] {
    return this.getAllLogs().filter((log) => log.sandboxId === sessionId);
  }

  /**
   * Get logs by execution type
   */
  getLogsByType(executionType: string): ExecutionLog[] {
    return this.getAllLogs().filter((log) => log.executionType === executionType);
  }

  /**
   * Get logs by status
   */
  getLogsByStatus(status: ExecutionLog['status']): ExecutionLog[] {
    return this.getAllLogs().filter((log) => log.status === status);
  }

  /**
   * Search logs by pattern
   */
  searchLogs(pattern: string | RegExp): ExecutionLog[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

    return this.getAllLogs().filter(
      (log) =>
        regex.test(log.output) ||
        regex.test(log.errors) ||
        log.warnings.some((w) => regex.test(w)),
    );
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    totalLogs: number;
    successCount: number;
    errorCount: number;
    timeoutCount: number;
    avgDuration: number;
    totalFileOps: number;
    totalNetworkReqs: number;
  } {
    const logs = this.getAllLogs();

    const stats = {
      totalLogs: logs.length,
      successCount: logs.filter((l) => l.status === 'success').length,
      errorCount: logs.filter((l) => l.status === 'error').length,
      timeoutCount: logs.filter((l) => l.status === 'timeout').length,
      avgDuration: logs.length > 0 ? logs.reduce((sum, l) => sum + (l.duration || 0), 0) / logs.length : 0,
      totalFileOps: logs.reduce((sum, l) => sum + l.fileOperations.length, 0),
      totalNetworkReqs: logs.reduce((sum, l) => sum + l.networkRequests.length, 0),
    };

    return stats;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(sessionId?: string): string {
    const logs = sessionId ? this.getLogsBySession(sessionId) : this.getAllLogs();

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportLogsCSV(sessionId?: string): string {
    const logs = sessionId ? this.getLogsBySession(sessionId) : this.getAllLogs();

    const headers = [
      'ID',
      'Type',
      'Status',
      'Duration (ms)',
      'Output Length',
      'Errors',
      'Warnings',
      'File Ops',
      'Network Reqs',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.executionType,
      log.status,
      log.duration || 0,
      log.output.length,
      log.errors.length > 0 ? '1' : '0',
      log.warnings.length,
      log.fileOperations.length,
      log.networkRequests.length,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }

  /**
   * Clear old logs
   */
  private cleanupOldLogs(ageMs: number = 86400000): void {
    // 24 hours default
    const cutoffTime = Date.now() - ageMs;
    let removed = 0;

    this.logs.forEach((log, id) => {
      if ((log.endTime || 0) < cutoffTime) {
        this.logs.delete(id);
        this.streams.delete(id);
        this.logBuffer.delete(id);
        this.fileOpsBuffer.delete(id);
        this.networkReqsBuffer.delete(id);
        this.logsStore.setKey(id, undefined as any);
        removed++;
      }
    });

    logger.debug(`Cleaned up ${removed} old logs`);
  }

  /**
   * Delete log
   */
  deleteLog(logId: string): void {
    this.logs.delete(logId);
    this.streams.delete(logId);
    this.logBuffer.delete(logId);
    this.fileOpsBuffer.delete(logId);
    this.networkReqsBuffer.delete(logId);
    this.logsStore.setKey(logId, undefined as any);

    logger.debug(`Log deleted: ${logId}`);
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    const count = this.logs.size;

    this.logs.clear();
    this.streams.clear();
    this.logBuffer.clear();
    this.fileOpsBuffer.clear();
    this.networkReqsBuffer.clear();
    this.logsStore.set({});

    logger.debug(`Cleared ${count} logs`);
  }
}

/**
 * Global execution logger instance
 */
let globalExecutionLogger: ExecutionLogger | null = null;

export function getExecutionLogger(): ExecutionLogger {
  if (!globalExecutionLogger) {
    globalExecutionLogger = new ExecutionLogger();
  }

  return globalExecutionLogger;
}
