/**
 * Tool Executor Module
 * 
 * Handles execution of browser tools, manages execution context,
 * and bridges between agent requests and browser tool implementations.
 */

import { createLogger } from "@/utils/logger";
import { ValidationError, ToolError } from "@/utils/error-handler";
import { BROWSER_TOOLS, getBrowserTool, type BrowserToolParams } from "./browser-tools";
import { BrowserBridge, getBrowserBridge, type BrowserBridgeConfig } from "./browser-bridge";

const logger = createLogger("tool-executor");

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  toolName: string;
  params: BrowserToolParams;
  timeout?: number;
  retryCount?: number;
  userId?: string;
  sessionId?: string;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  data?: any;
  error?: string;
  duration: number;
  retries?: number;
  cacheHit?: boolean;
}

/**
 * Tool execution cache
 */
interface CacheEntry {
  result: ToolExecutionResult;
  timestamp: number;
  ttl: number;
}

/**
 * Tool Executor - Central execution engine
 */
export class ToolExecutor {
  private static instance: ToolExecutor;
  private bridge: BrowserBridge;
  private cache: Map<string, CacheEntry> = new Map();
  private executionMetrics: Map<string, ToolExecutionMetrics> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes

  private constructor(bridgeConfig?: Partial<BrowserBridgeConfig>) {
    this.bridge = getBrowserBridge(bridgeConfig);
    this.initializeCleanupInterval();
    logger.debug("ToolExecutor initialized");
  }

  static getInstance(bridgeConfig?: Partial<BrowserBridgeConfig>): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor(bridgeConfig);
    }
    return ToolExecutor.instance;
  }

  /**
   * Execute a tool with retry logic and caching
   */
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(context);

    // Validate tool exists
    const tool = getBrowserTool(context.toolName);
    if (!tool) {
      throw new ValidationError(`Tool not found: ${context.toolName}`);
    }

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug({ tool: context.toolName }, "Cache hit for tool execution");
      return {
        ...cached.result,
        cacheHit: true,
        duration: Date.now() - startTime,
      };
    }

    // Validate parameters
    this.validateParameters(tool, context.params);

    // Execute with retry logic
    let lastError: Error | null = null;
    const retryCount = context.retryCount ?? 2;
    let retries = 0;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        logger.debug(
          { tool: context.toolName, attempt: attempt + 1, maxAttempts: retryCount + 1 },
          "Executing tool"
        );

        const result = await Promise.race([
          this.bridge.execute(context.toolName, context.params),
          this.createTimeout(context.timeout ?? this.DEFAULT_TIMEOUT),
        ]);

        if (!result.success) {
          throw new ToolError(result.error || "Tool execution failed");
        }

        const executionResult: ToolExecutionResult = {
          success: true,
          toolName: context.toolName,
          data: result.data,
          duration: Date.now() - startTime,
          retries,
        };

        // Cache the result
        this.cache.set(cacheKey, {
          result: executionResult,
          timestamp: Date.now(),
          ttl: this.DEFAULT_CACHE_TTL,
        });

        // Record metrics
        this.recordMetrics(context.toolName, executionResult);

        logger.info(
          { tool: context.toolName, duration: executionResult.duration },
          "Tool execution successful"
        );

        return executionResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryCount) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(
            { tool: context.toolName, attempt, backoffMs, error: lastError.message },
            "Tool execution failed, retrying..."
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          retries++;
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || "Tool execution failed after all retries";
    logger.error(
      { tool: context.toolName, retries, error: errorMessage },
      "Tool execution failed after all retries"
    );

    const result: ToolExecutionResult = {
      success: false,
      toolName: context.toolName,
      error: errorMessage,
      duration: Date.now() - startTime,
      retries,
    };

    this.recordMetrics(context.toolName, result);
    return result;
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeSequence(contexts: ToolExecutionContext[]): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const context of contexts) {
      const result = await this.execute(context);
      results.push(result);

      if (!result.success) {
        logger.warn(
          { tool: context.toolName, error: result.error },
          "Tool in sequence failed, continuing..."
        );
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(contexts: ToolExecutionContext[]): Promise<ToolExecutionResult[]> {
    return Promise.all(contexts.map((ctx) => this.execute(ctx)));
  }

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return Object.values(BROWSER_TOOLS).map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
    }));
  }

  /**
   * Get tool information
   */
  getTool(toolName: string) {
    const tool = getBrowserTool(toolName);
    if (!tool) {
      throw new ValidationError(`Tool not found: ${toolName}`);
    }

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
    };
  }

  /**
   * Clear cache
   */
  clearCache(toolName?: string): number {
    if (toolName) {
      const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
        key.startsWith(`${toolName}:`)
      );
      keysToDelete.forEach((key) => this.cache.delete(key));
      return keysToDelete.length;
    } else {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }
  }

  /**
   * Get execution metrics
   */
  getMetrics(toolName?: string) {
    if (toolName) {
      return this.executionMetrics.get(toolName);
    }
    return Array.from(this.executionMetrics.values());
  }

  /**
   * Private methods
   */

  private validateParameters(tool: any, params: BrowserToolParams): void {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        throw new ValidationError(`Missing required parameter: ${param.name}`);
      }

      if (param.name in params) {
        const value = params[param.name];
        const valueType = Array.isArray(value) ? "array" : typeof value;

        if (!this.isValidType(valueType, param.type)) {
          throw new ValidationError(
            `Invalid type for parameter ${param.name}: expected ${param.type}, got ${valueType}`
          );
        }
      }
    }
  }

  private isValidType(actual: string, expected: string): boolean {
    if (expected === "string[]") {
      return actual === "array";
    }
    return actual === expected;
  }

  private generateCacheKey(context: ToolExecutionContext): string {
    const paramString = JSON.stringify(context.params);
    return `${context.toolName}:${paramString}`;
  }

  private recordMetrics(toolName: string, result: ToolExecutionResult): void {
    let metrics = this.executionMetrics.get(toolName);

    if (!metrics) {
      metrics = {
        toolName,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
      };
      this.executionMetrics.set(toolName, metrics);
    }

    metrics.executionCount++;
    metrics.totalDuration += result.duration;
    metrics.averageDuration = metrics.totalDuration / metrics.executionCount;
    metrics.minDuration = Math.min(metrics.minDuration, result.duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, result.duration);

    if (result.success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms`)), ms)
    );
  }

  private initializeCleanupInterval(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug({ count: cleaned }, "Cleaned up expired cache entries");
      }
    }, 300000);
  }
}

/**
 * Tool execution metrics
 */
export interface ToolExecutionMetrics {
  toolName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Convenience functions
 */

export async function executeTool(
  toolName: string,
  params: BrowserToolParams,
  timeout?: number
): Promise<ToolExecutionResult> {
  const executor = ToolExecutor.getInstance();
  return executor.execute({
    toolName,
    params,
    timeout,
  });
}

export function getExecutor(config?: Partial<BrowserBridgeConfig>): ToolExecutor {
  return ToolExecutor.getInstance(config);
}

export function getAvailableTools() {
  return ToolExecutor.getInstance().getAvailableTools();
}
