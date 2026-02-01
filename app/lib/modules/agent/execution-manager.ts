import type { LanguageModelV1 } from 'ai';
import { generateText, streamText } from 'ai';
import { LLMManager } from '../llm/manager';
import { getExecutionCache } from './execution-cache';
import type { ExecutionOptions, ExecutionResult, AgentMetrics } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AgentExecutionManager');

export class AgentExecutionManager {
  private static _instance: AgentExecutionManager;
  private llmManager: LLMManager;
  private cache = getExecutionCache();
  private metrics: Map<string, AgentMetrics> = new Map();
  private activeExecutions: Map<string, Promise<any>> = new Map();

  private constructor() {
    this.llmManager = LLMManager.getInstance();
  }

  static getInstance(): AgentExecutionManager {
    if (!AgentExecutionManager._instance) {
      AgentExecutionManager._instance = new AgentExecutionManager();
    }
    return AgentExecutionManager._instance;
  }

  /**
   * Execute with a specific agent synchronously
   */
  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const {
      agent,
      model,
      prompt,
      messages = [],
      system,
      temperature = 0.7,
      maxTokens,
      useCache = true,
      timeout = 30000,
      retryCount = 2,
    } = options;

    const startTime = Date.now();
    const executionId = `${agent}:${model}:${Date.now()}:${Math.random()}`;

    try {
      // Check cache first
      if (useCache) {
        const inputKey = prompt || JSON.stringify(messages);
        const cached = this.cache.get(agent, model, inputKey);
        if (cached) {
          logger.info(`Cache hit for ${agent}:${model}`);
          this.recordMetrics(agent, model, {
            cacheHit: true,
            duration: Date.now() - startTime,
          });
          return {
            success: true,
            data: cached,
            cacheHit: true,
            duration: Date.now() - startTime,
            executionId,
          };
        }
      }

      // Get model instance
      const provider = this.llmManager.getProvider(agent);
      if (!provider) {
        throw new Error(`Agent provider not found: ${agent}`);
      }

      const modelInstance = provider.getModelInstance({
        model,
        serverEnv: {} as Env,
      });

      // Execute with retry logic
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          const result = await Promise.race([
            generateText({
              model: modelInstance,
              prompt: prompt || undefined,
              messages: messages.length > 0 ? messages : undefined,
              system,
              temperature,
              maxTokens,
            }),
            this.createTimeout(timeout),
          ]);

          // Cache the result
          if (useCache) {
            const inputKey = prompt || JSON.stringify(messages);
            this.cache.set(agent, model, inputKey, result.text, undefined, {
              input: result.usage?.promptTokens || 0,
              output: result.usage?.completionTokens || 0,
            });
          }

          this.recordMetrics(agent, model, {
            success: true,
            duration: Date.now() - startTime,
            inputTokens: result.usage?.promptTokens,
            outputTokens: result.usage?.completionTokens,
          });

          return {
            success: true,
            data: result.text,
            usage: {
              inputTokens: result.usage?.promptTokens || 0,
              outputTokens: result.usage?.completionTokens || 0,
            },
            duration: Date.now() - startTime,
            executionId,
          };
        } catch (error) {
          lastError = error as Error;
          if (attempt < retryCount) {
            logger.warn(`Attempt ${attempt + 1} failed for ${agent}, retrying...`, (error as Error).message);
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // exponential backoff
          }
        }
      }

      throw lastError || new Error('Execution failed after retries');
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(`Execution failed for ${agent}:${model}`, errorMessage);

      this.recordMetrics(agent, model, {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
        executionId,
      };
    }
  }

  /**
   * Stream execution for real-time response
   */
  async *stream(options: ExecutionOptions) {
    const {
      agent,
      model,
      prompt,
      messages = [],
      system,
      temperature = 0.7,
      maxTokens,
    } = options;

    const startTime = Date.now();

    try {
      const provider = this.llmManager.getProvider(agent);
      if (!provider) {
        throw new Error(`Agent provider not found: ${agent}`);
      }

      const modelInstance = provider.getModelInstance({
        model,
        serverEnv: {} as Env,
      });

      const { stream: textStream, usage } = await streamText({
        model: modelInstance,
        prompt: prompt || undefined,
        messages: messages.length > 0 ? messages : undefined,
        system,
        temperature,
        maxTokens,
      });

      let fullText = '';
      for await (const chunk of textStream) {
        fullText += chunk;
        yield {
          type: 'chunk',
          data: chunk,
          duration: Date.now() - startTime,
        };
      }

      this.recordMetrics(agent, model, {
        success: true,
        duration: Date.now() - startTime,
      });

      yield {
        type: 'complete',
        data: fullText,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(`Stream execution failed for ${agent}:${model}`, errorMessage);
      this.recordMetrics(agent, model, {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      });
      yield {
        type: 'error',
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get available agents and models
   */
  getAvailableAgents() {
    return this.llmManager.getAllProviders().map((provider) => ({
      name: provider.name,
      models: provider.staticModels,
      icon: provider.icon,
      apiKeyLink: provider.getApiKeyLink,
    }));
  }

  /**
   * Get metrics for agent
   */
  getMetrics(agent: string) {
    return this.metrics.get(agent) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return Array.from(this.metrics.entries()).map(([agent, metrics]) => ({
      agent,
      ...metrics,
    }));
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(agent: string, model: string, data: any): void {
    const key = agent;
    const existing = this.metrics.get(key) || {
      agent,
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      cacheHits: 0,
    };

    if (data.success) {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }

    existing.totalExecutions++;
    existing.averageDuration =
      (existing.averageDuration * (existing.totalExecutions - 1) + data.duration) / existing.totalExecutions;

    if (data.inputTokens) {
      existing.totalInputTokens += data.inputTokens;
    }
    if (data.outputTokens) {
      existing.totalOutputTokens += data.outputTokens;
    }
    if (data.cacheHit) {
      existing.cacheHits++;
    }

    this.metrics.set(key, existing);
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}

export function getExecutionManager(): AgentExecutionManager {
  return AgentExecutionManager.getInstance();
}
