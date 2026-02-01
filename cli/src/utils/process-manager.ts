/**
 * Process Manager - Handles child process lifecycle and cleanup
 */

import { ChildProcess } from 'child_process';
import { createLogger } from './logger';

const logger = createLogger('process-manager');

export interface ProcessMetadata {
  pid: number;
  command: string;
  startTime: Date;
  timeout?: number;
}

export class ProcessManager {
  private processes: Map<number, ProcessMetadata & { process: ChildProcess }>;
  private timeouts: Map<number, NodeJS.Timeout>;

  constructor() {
    this.processes = new Map();
    this.timeouts = new Map();

    // Handle process termination gracefully
    process.on('exit', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  /**
   * Register a process
   */
  registerProcess(
    process: ChildProcess,
    command: string,
    timeout?: number
  ): number | null {
    if (!process.pid) {
      logger.warn('Process has no PID');
      return null;
    }

    const metadata: ProcessMetadata & { process: ChildProcess } = {
      pid: process.pid,
      command,
      startTime: new Date(),
      timeout,
      process
    };

    this.processes.set(process.pid, metadata);
    logger.debug({ pid: process.pid, command }, 'Process registered');

    // Set up timeout if specified
    if (timeout) {
      const timeoutHandle = setTimeout(() => {
        this.killProcess(process.pid!, 'TIMEOUT');
      }, timeout);

      this.timeouts.set(process.pid, timeoutHandle);
    }

    return process.pid;
  }

  /**
   * Unregister a process
   */
  unregisterProcess(pid: number): void {
    const metadata = this.processes.get(pid);
    if (metadata) {
      this.processes.delete(pid);
      logger.debug({ pid }, 'Process unregistered');
    }

    // Clear timeout if exists
    const timeout = this.timeouts.get(pid);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(pid);
    }
  }

  /**
   * Kill a specific process
   */
  killProcess(pid: number, reason: string = 'SIGTERM'): void {
    const metadata = this.processes.get(pid);
    if (!metadata) {
      logger.warn({ pid }, 'Process not found');
      return;
    }

    try {
      const signal = reason === 'TIMEOUT' ? 'SIGKILL' : 'SIGTERM';
      metadata.process.kill(signal);
      logger.info({ pid, reason, signal }, 'Process killed');
    } catch (error) {
      logger.error({ pid, error }, 'Failed to kill process');
    }

    this.unregisterProcess(pid);
  }

  /**
   * Get process metadata
   */
  getProcessMetadata(pid: number): ProcessMetadata | null {
    const metadata = this.processes.get(pid);
    return metadata
      ? {
          pid: metadata.pid,
          command: metadata.command,
          startTime: metadata.startTime,
          timeout: metadata.timeout
        }
      : null;
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): ProcessMetadata[] {
    return Array.from(this.processes.values()).map(m => ({
      pid: m.pid,
      command: m.command,
      startTime: m.startTime,
      timeout: m.timeout
    }));
  }

  /**
   * Cleanup all processes
   */
  cleanup(): void {
    logger.info(`Cleaning up ${this.processes.size} processes`);

    for (const [pid, metadata] of this.processes) {
      try {
        metadata.process.kill('SIGTERM');
      } catch (error) {
        logger.error({ pid, error }, 'Error killing process during cleanup');
      }
    }

    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    this.processes.clear();
    this.timeouts.clear();
  }

  /**
   * Wait for process completion
   */
  waitForProcess(pid: number, timeout?: number): Promise<number | null> {
    return new Promise((resolve) => {
      const metadata = this.processes.get(pid);
      if (!metadata) {
        resolve(null);
        return;
      }

      let completed = false;
      const timeoutHandle = timeout
        ? setTimeout(() => {
            if (!completed) {
              completed = true;
              this.killProcess(pid, 'TIMEOUT');
              resolve(null);
            }
          }, timeout)
        : null;

      metadata.process.once('exit', (code) => {
        if (!completed) {
          completed = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          this.unregisterProcess(pid);
          resolve(code);
        }
      });
    });
  }

  /**
   * Get process count
   */
  getProcessCount(): number {
    return this.processes.size;
  }
}

// Singleton instance
export const processManager = new ProcessManager();
