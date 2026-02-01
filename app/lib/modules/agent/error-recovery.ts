import { getExecutionManager } from './execution-manager';
import type { ExecutionOptions, ExecutionResult, FallbackConfig } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ErrorRecovery');

export interface RetryStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface FallbackStrategy {
  fallbackAgents: Array<{
    agent: string;
    model: string;
    priority: number;
  }>;
  fallbackOnError: boolean;
  fallbackOnTimeout: boolean;
}

export class ErrorRecovery {
  private static readonly DEFAULT_RETRY_STRATEGY: RetryStrategy = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  };

  private static readonly DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = {
    fallbackAgents: [],
    fallbackOnError: true,
    fallbackOnTimeout: true,
  };

  /**
   * Execute with automatic retry on failure
   */
  static async executeWithRetry(
    options: ExecutionOptions,
    strategy: RetryStrategy = ErrorRecovery.DEFAULT_RETRY_STRATEGY,
  ): Promise<ExecutionResult> {
    const manager = getExecutionManager();
    let lastError: Error | null = null;
    let lastResult: ExecutionResult | null = null;

    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt + 1}/${strategy.maxRetries + 1} for ${options.agent}:${options.model}`);

        const result = await manager.execute(options);

        if (result.success) {
          logger.info(`Success on attempt ${attempt + 1}`);
          return result;
        }

        lastResult = result;
        lastError = new Error(result.error || 'Execution failed');

        if (attempt < strategy.maxRetries) {
          const delay = Math.min(
            strategy.initialDelayMs * Math.pow(strategy.backoffMultiplier, attempt),
            strategy.maxDelayMs,
          );
          logger.warn(`Retrying after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error as Error;
        logger.error(`Attempt ${attempt + 1} threw error:`, lastError.message);

        if (attempt < strategy.maxRetries) {
          const delay = Math.min(
            strategy.initialDelayMs * Math.pow(strategy.backoffMultiplier, attempt),
            strategy.maxDelayMs,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`All retry attempts failed for ${options.agent}:${options.model}`);
    return lastResult || {
      success: false,
      error: lastError?.message || 'Execution failed after all retries',
      duration: 0,
      executionId: `failed-${Date.now()}`,
    };
  }

  /**
   * Execute with automatic fallback to alternative agents
   */
  static async executeWithFallback(
    options: ExecutionOptions,
    fallbackAgents: Array<{ agent: string; model: string }> = [],
    strategy: RetryStrategy = ErrorRecovery.DEFAULT_RETRY_STRATEGY,
  ): Promise<ExecutionResult & { fallbackUsed?: string }> {
    const manager = getExecutionManager();

    // Try primary agent first
    const primaryResult = await ErrorRecovery.executeWithRetry(options, strategy);
    if (primaryResult.success) {
      return primaryResult;
    }

    logger.warn(`Primary agent ${options.agent}:${options.model} failed, trying fallback agents...`);

    // Try fallback agents in order
    for (const fallback of fallbackAgents) {
      try {
        logger.info(`Trying fallback: ${fallback.agent}:${fallback.model}`);

        const fallbackOptions: ExecutionOptions = {
          ...options,
          agent: fallback.agent,
          model: fallback.model,
        };

        const result = await ErrorRecovery.executeWithRetry(fallbackOptions, strategy);

        if (result.success) {
          logger.info(`Fallback agent ${fallback.agent}:${fallback.model} succeeded`);
          return {
            ...result,
            fallbackUsed: `${fallback.agent}:${fallback.model}`,
          };
        }
      } catch (error) {
        logger.warn(`Fallback agent ${fallback.agent}:${fallback.model} failed:`, (error as Error).message);
      }
    }

    logger.error('All fallback agents failed');
    return {
      ...primaryResult,
      fallbackUsed: 'none',
    };
  }

  /**
   * Circuit breaker pattern for failing agents
   */
  static createCircuitBreaker(threshold: number = 5, resetTimeMs: number = 60000) {
    const failures = new Map<string, number>();
    const lastFailureTime = new Map<string, number>();
    const isOpen = new Map<string, boolean>();

    return {
      canExecute(agent: string): boolean {
        // Check if circuit should reset
        if (isOpen.get(agent)) {
          const lastFailure = lastFailureTime.get(agent) || 0;
          if (Date.now() - lastFailure > resetTimeMs) {
            logger.info(`Resetting circuit breaker for ${agent}`);
            isOpen.delete(agent);
            failures.delete(agent);
            return true;
          }
          return false;
        }
        return true;
      },

      recordSuccess(agent: string): void {
        failures.delete(agent);
        lastFailureTime.delete(agent);
      },

      recordFailure(agent: string): void {
        const count = (failures.get(agent) || 0) + 1;
        failures.set(agent, count);
        lastFailureTime.set(agent, Date.now());

        if (count >= threshold) {
          logger.warn(`Circuit breaker opened for ${agent} after ${count} failures`);
          isOpen.set(agent, true);
        }
      },

      getStatus(agent: string) {
        return {
          agent,
          failures: failures.get(agent) || 0,
          isOpen: isOpen.get(agent) || false,
          lastFailure: lastFailureTime.get(agent) || null,
        };
      },
    };
  }

  /**
   * Detect error type for better handling
   */
  static detectErrorType(error: string): 'rate_limit' | 'auth_error' | 'model_error' | 'timeout' | 'unknown' {
    const lowerError = error.toLowerCase();

    if (
      lowerError.includes('rate limit') ||
      lowerError.includes('too many requests') ||
      lowerError.includes('429')
    ) {
      return 'rate_limit';
    }

    if (
      lowerError.includes('unauthorized') ||
      lowerError.includes('authentication') ||
      lowerError.includes('invalid api key') ||
      lowerError.includes('401') ||
      lowerError.includes('403')
    ) {
      return 'auth_error';
    }

    if (
      lowerError.includes('timeout') ||
      lowerError.includes('timed out') ||
      lowerError.includes('deadline')
    ) {
      return 'timeout';
    }

    if (
      lowerError.includes('model') ||
      lowerError.includes('not found') ||
      lowerError.includes('invalid') ||
      lowerError.includes('400') ||
      lowerError.includes('500')
    ) {
      return 'model_error';
    }

    return 'unknown';
  }

  /**
   * Get recommended retry strategy based on error type
   */
  static getRetryStrategyForError(errorType: string): RetryStrategy {
    switch (ErrorRecovery.detectErrorType(errorType)) {
      case 'rate_limit':
        return {
          maxRetries: 5,
          backoffMultiplier: 3, // More aggressive backoff for rate limits
          initialDelayMs: 2000,
          maxDelayMs: 60000,
        };

      case 'timeout':
        return {
          maxRetries: 2,
          backoffMultiplier: 2,
          initialDelayMs: 500,
          maxDelayMs: 10000,
        };

      case 'auth_error':
        return {
          maxRetries: 0, // Don't retry auth errors
          backoffMultiplier: 1,
          initialDelayMs: 0,
          maxDelayMs: 0,
        };

      default:
        return ErrorRecovery.DEFAULT_RETRY_STRATEGY;
    }
  }
}
