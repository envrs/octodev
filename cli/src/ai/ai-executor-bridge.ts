/**
 * AI Executor Bridge
 * Connects CommandConverter output to SafeExecutor with validation and learning
 */

import { SafeExecutor } from "@/tools/executor";
import { CommandConverter } from "@/ai/command-converter";
import { StreamingHandler, StreamCallback } from "@/ai/streaming-handler";
import { SessionMemory } from "@/memory/session-memory";
import { ToolExecutionResult } from "@/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ai-executor-bridge");

/**
 * Result of AI-powered command execution
 */
export interface AIExecutionResult {
  success: boolean;
  command: string;
  output: string;
  error?: string;
  suggestion?: string;
  isUnsafe: boolean;
  confidence: number;
  tokens: number;
  cost: number;
}

/**
 * Bridge configuration
 */
export interface AIExecutorBridgeConfig {
  converter: CommandConverter;
  executor: SafeExecutor;
  streamHandler: StreamingHandler;
  memory: SessionMemory;
  sessionId: string;
}

/**
 * AI Executor Bridge
 * Validates and executes AI-generated commands with fallback and learning
 */
export class AIExecutorBridge {
  private converter: CommandConverter;
  private executor: SafeExecutor;
  private streamHandler: StreamingHandler;
  private memory: SessionMemory;
  private sessionId: string;

  constructor(config: AIExecutorBridgeConfig) {
    this.converter = config.converter;
    this.executor = config.executor;
    this.streamHandler = config.streamHandler;
    this.memory = config.memory;
    this.sessionId = config.sessionId;
  }

  /**
   * Execute natural language request through AI pipeline
   */
  async executeAIRequest(
    naturalLanguageRequest: string,
    workingDir: string,
    onStream?: StreamCallback
  ): Promise<AIExecutionResult> {
    const startTime = Date.now();

    try {
      logger.debug({ request: naturalLanguageRequest }, "Converting natural language to command");

      // Step 1: Convert natural language to tool command
      const conversion = await this.converter.convert(naturalLanguageRequest);

      if (!conversion.success) {
        return {
          success: false,
          command: naturalLanguageRequest,
          output: "",
          error: `Failed to understand request: ${conversion.error}`,
          suggestion: `Try being more specific. Example: "show the contents of config.json"`,
          isUnsafe: false,
          confidence: conversion.confidence || 0,
          tokens: conversion.tokensUsed || 0,
          cost: conversion.estimatedCost || 0,
        };
      }

      const command = conversion.command!;
      const confidence = conversion.confidence || 0;

      logger.debug(
        { naturalRequest: naturalLanguageRequest, convertedCommand: command, confidence },
        "Natural language converted to command"
      );

      // Step 2: Validate command safety
      if (!this.isCommandSafe(command)) {
        const recoveryHint = this.getSafeAlternative(command);
        return {
          success: false,
          command,
          output: "",
          error: `Command validation failed: "${command}" is not allowed for safety reasons`,
          suggestion: recoveryHint,
          isUnsafe: true,
          confidence,
          tokens: conversion.tokensUsed || 0,
          cost: conversion.estimatedCost || 0,
        };
      }

      // Step 3: Execute the command
      logger.debug({ command, workingDir }, "Executing AI-generated command");

      const executionResult = await this.executor.execute(
        command,
        {
          sessionId: this.sessionId,
          workingDir,
        },
        onStream
      );

      // Step 4: Record execution in memory for learning
      await this.memory.recordCommand({
        input: naturalLanguageRequest,
        command,
        toolName: command.split(" ")[0],
        success: executionResult.success,
        output: executionResult.output || "",
        errorMessage: executionResult.error,
        aiGenerated: true,
        confidence,
      });

      // Step 5: Track success for learning
      if (executionResult.success) {
        await this.memory.recordSuccess(command, confidence);
        logger.debug({ command, confidence }, "Command execution successful, recorded for learning");
      } else {
        await this.memory.recordFailure(command, executionResult.error || "Unknown error");
      }

      const duration = Date.now() - startTime;

      return {
        success: executionResult.success,
        command,
        output: executionResult.output || "",
        error: executionResult.error,
        isUnsafe: false,
        confidence,
        tokens: conversion.tokensUsed || 0,
        cost: conversion.estimatedCost || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, request: naturalLanguageRequest }, "Bridge execution failed");

      return {
        success: false,
        command: naturalLanguageRequest,
        output: "",
        error: `Execution bridge error: ${errorMessage}`,
        isUnsafe: false,
        confidence: 0,
        tokens: 0,
        cost: 0,
      };
    }
  }

  /**
   * Check if command is safe to execute
   */
  private isCommandSafe(command: string): boolean {
    // This would integrate with CommandValidator from Phase 2
    // For now, reject obvious dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /mkfs/i,
      /dd\s+if=/i,
      /chmod\s+777/i,
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(command));
  }

  /**
   * Get safe alternative to unsafe command
   */
  private getSafeAlternative(command: string): string {
    if (/rm\s+-rf/i.test(command)) {
      return 'Consider using "file-delete" tool instead for safer deletion';
    }
    if (/chmod\s+777/i.test(command)) {
      return 'Use file operations with explicit permission settings instead';
    }
    return "Try a different approach or use available tools";
  }

  /**
   * Get execution statistics for this session
   */
  getSessionStats() {
    return {
      totalTokens: this.memory.getSessionMetrics()?.totalTokens || 0,
      totalCost: this.memory.getSessionMetrics()?.totalCost || 0,
      successRate: this.memory.getSessionMetrics()?.successRate || 0,
    };
  }
}

/**
 * Factory function to create bridge instance
 */
export function createAIExecutorBridge(
  converter: CommandConverter,
  executor: SafeExecutor,
  streamHandler: StreamingHandler,
  memory: SessionMemory,
  sessionId: string
): AIExecutorBridge {
  return new AIExecutorBridge({
    converter,
    executor,
    streamHandler,
    memory,
    sessionId,
  });
}
