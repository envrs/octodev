import { getExecutionManager } from './execution-manager';
import { ErrorRecovery } from './error-recovery';
import type { ExecutionOptions } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ActionRunnerAdapter');

/**
 * Adapter to integrate agent execution with existing ActionRunner
 * This maintains backward compatibility while providing enhanced agent support
 */
export class ActionRunnerAdapter {
  /**
   * Execute an action using specified agent
   * Fallback to default agent if execution fails
   */
  static async executeAction(
    action: string,
    agent: string = 'OpenAI',
    model: string = 'gpt-4o',
    options: {
      useCache?: boolean;
      retryCount?: number;
      fallbackAgents?: Array<{ agent: string; model: string }>;
      timeout?: number;
    } = {},
  ) {
    const executionOptions: ExecutionOptions = {
      agent,
      model,
      prompt: action,
      useCache: options.useCache ?? true,
      retryCount: options.retryCount ?? 2,
      timeout: options.timeout ?? 30000,
    };

    try {
      if (options.fallbackAgents && options.fallbackAgents.length > 0) {
        return await ErrorRecovery.executeWithFallback(executionOptions, options.fallbackAgents);
      } else {
        return await ErrorRecovery.executeWithRetry(executionOptions);
      }
    } catch (error) {
      logger.error('Action execution failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Stream action execution for real-time updates
   */
  static async *streamAction(
    action: string,
    agent: string = 'OpenAI',
    model: string = 'gpt-4o',
    options: {
      useCache?: boolean;
      timeout?: number;
    } = {},
  ) {
    const executionOptions: ExecutionOptions = {
      agent,
      model,
      prompt: action,
      useCache: options.useCache ?? true,
      timeout: options.timeout ?? 30000,
    };

    const manager = getExecutionManager();

    try {
      for await (const chunk of manager.stream(executionOptions)) {
        yield chunk;
      }
    } catch (error) {
      logger.error('Stream execution failed:', (error as Error).message);
      yield {
        type: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Validate action compatibility with agent
   */
  static validateActionForAgent(
    action: string,
    agent: string,
  ): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic validation
    if (!action || action.trim().length === 0) {
      errors.push('Action prompt cannot be empty');
    }

    if (action.length > 10000) {
      warnings.push('Action prompt is very long, may impact performance');
    }

    // Agent-specific validation
    if (agent === 'Anthropic') {
      if (action.includes('execute') || action.includes('shell')) {
        warnings.push('Anthropic models may have limitations with shell commands');
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Get recommended agent for action type
   */
  static getRecommendedAgent(actionType: string): { agent: string; model: string } {
    const actionLower = actionType.toLowerCase();

    if (actionLower.includes('code') || actionLower.includes('programming')) {
      return { agent: 'Anthropic', model: 'claude-3-5-sonnet-20241022' };
    }

    if (actionLower.includes('reasoning') || actionLower.includes('complex')) {
      return { agent: 'OpenAI', model: 'o1-preview' };
    }

    if (actionLower.includes('fast') || actionLower.includes('quick')) {
      return { agent: 'OpenAI', model: 'gpt-4o-mini' };
    }

    // Default to Claude for best overall performance
    return { agent: 'Anthropic', model: 'claude-3-5-sonnet-20241022' };
  }

  /**
   * Create fallback chain for reliability
   */
  static createFallbackChain(): Array<{ agent: string; model: string }> {
    return [
      { agent: 'Anthropic', model: 'claude-3-5-sonnet-20241022' },
      { agent: 'OpenAI', model: 'gpt-4o' },
      { agent: 'OpenAI', model: 'gpt-4o-mini' },
      { agent: 'Anthropic', model: 'claude-3-haiku-20240307' },
    ];
  }
}
