import { vi } from 'vitest';
import type {
  Tool,
  ToolExecutionResult,
  ToolRegistry as IToolRegistry,
} from '@/types';

/**
 * Mock Executor Service for testing
 */
export class MockExecutorService {
  private results: Map<string, ToolExecutionResult> = new Map();
  private callCount: Map<string, number> = new Map();

  setResult(toolName: string, result: ToolExecutionResult) {
    this.results.set(toolName, result);
  }

  async executeTool(
    toolName: string,
    _input: string
  ): Promise<ToolExecutionResult> {
    this.incrementCallCount(toolName);
    return (
      this.results.get(toolName) || {
        success: true,
        output: 'Mock result',
        toolName,
      }
    );
  }

  getCallCount(toolName: string): number {
    return this.callCount.get(toolName) || 0;
  }

  private incrementCallCount(toolName: string) {
    this.callCount.set(toolName, (this.callCount.get(toolName) || 0) + 1);
  }

  reset() {
    this.results.clear();
    this.callCount.clear();
  }
}

/**
 * Mock AI Provider for testing
 */
export class MockAIProvider {
  private suggestions: string[] = [];
  private shouldFail: boolean = false;

  setSuggestions(suggestions: string[]) {
    this.suggestions = suggestions;
  }

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async generateSuggestions(): Promise<string[]> {
    if (this.shouldFail) {
      throw new Error('AI provider error');
    }
    return this.suggestions;
  }

  async streamResponse(
    _prompt: string,
    onToken: (token: string) => void
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error('AI streaming error');
    }

    const response = 'This is a mock AI response';
    for (const char of response) {
      onToken(char);
    }
  }
}

/**
 * Mock File System for testing
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private readCalls: number = 0;
  private writeCalls: number = 0;

  setFile(path: string, content: string) {
    this.files.set(path, content);
  }

  getFile(path: string): string | undefined {
    this.readCalls++;
    return this.files.get(path);
  }

  writeFile(path: string, content: string) {
    this.writeCalls++;
    this.files.set(path, content);
  }

  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }

  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  getReadCallCount(): number {
    return this.readCalls;
  }

  getWriteCallCount(): number {
    return this.writeCalls;
  }

  reset() {
    this.files.clear();
    this.readCalls = 0;
    this.writeCalls = 0;
  }
}

/**
 * Mock Process Manager for testing
 */
export class MockProcessManager {
  private processes: Map<number, { command: string; timeout: number }> =
    new Map();
  private nextPid: number = 1000;

  async spawn(
    command: string,
    _args: string[],
    _options: any
  ): Promise<{ pid: number; stdout: string; stderr: string; exitCode: number }> {
    const pid = this.nextPid++;
    this.processes.set(pid, { command, timeout: 30000 });

    // Simulate command execution
    return {
      pid,
      stdout: `Command: ${command}`,
      stderr: '',
      exitCode: 0,
    };
  }

  async kill(pid: number): Promise<boolean> {
    return this.processes.delete(pid);
  }

  getProcessCount(): number {
    return this.processes.size;
  }

  reset() {
    this.processes.clear();
    this.nextPid = 1000;
  }
}

/**
 * Test data fixtures
 */
export const testFixtures = {
  validFile: '/tmp/test.txt',
  validDir: '/tmp',
  invalidPath: '../../etc/passwd',
  largeFile: '/tmp/large.bin',
  safeCommand: 'ls -la',
  unsafeCommand: 'rm -rf /',

  mockTool: {
    name: 'test-tool',
    description: 'Test tool',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
  } as Tool,

  mockSuggestion: {
    command: 'file-read /tmp/config.json',
    description: 'Read configuration file',
    confidence: 0.95,
  },

  mockExecutionResult: {
    success: true,
    output: 'Test output',
    toolName: 'test-tool',
  } as ToolExecutionResult,
};

/**
 * Helper to create a delay
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Helper to assert performance baseline
 */
export function assertPerformance(duration: number, baseline: number) {
  if (duration > baseline) {
    console.warn(
      `Performance baseline exceeded: ${duration}ms > ${baseline}ms`
    );
  }
}
