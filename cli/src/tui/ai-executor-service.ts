/**
 * AI-Enhanced Executor Service
 * Extends ExecutorService with AI suggestion, conversion, and streaming capabilities
 */

import { ExecutorService, ExecutorServiceConfig } from "./executor-service";
import { AIExecutorBridge, AIExecutionResult } from "@/ai/ai-executor-bridge";
import { SuggestionEngine, Suggestion } from "@/ai/suggestion-engine";
import { CommandConverter } from "@/ai/command-converter";
import { StreamingHandler, StreamCallback } from "@/ai/streaming-handler";
import { MacroEngine } from "@/ai/macro-engine";
import { SessionMemory } from "@/memory/session-memory";
import { ProviderManager } from "@/ai/provider-manager";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ai-executor-service");

/**
 * AI Executor Service Configuration
 */
export interface AIExecutorServiceConfig extends ExecutorServiceConfig {
  aiEnabled?: boolean;
  suggestionsEnabled?: boolean;
  streamingEnabled?: boolean;
  macroDetectionEnabled?: boolean;
  macroThreshold?: number;
}

/**
 * AI-Enhanced Executor Service
 */
export class AIExecutorService {
  private executorService: ExecutorService;
  private bridge?: AIExecutorBridge;
  private suggestionEngine?: SuggestionEngine;
  private streamHandler?: StreamingHandler;
  private macroEngine?: MacroEngine;
  private sessionMemory?: SessionMemory;
  private providerManager?: ProviderManager;
  private config: AIExecutorServiceConfig;
  private sessionId: string;

  constructor(config: AIExecutorServiceConfig = {}, sessionId: string) {
    this.config = {
      aiEnabled: true,
      suggestionsEnabled: true,
      streamingEnabled: true,
      macroDetectionEnabled: true,
      macroThreshold: 3,
      ...config,
    };

    this.sessionId = sessionId;
    this.executorService = new ExecutorService(config);

    logger.debug({ config }, "AIExecutorService initialized");
  }

  /**
   * Initialize AI components
   */
  async initializeAI(apiKey: string): Promise<void> {
    if (!this.config.aiEnabled) {
      logger.debug("AI disabled by configuration");
      return;
    }

    try {
      this.providerManager = new ProviderManager(apiKey);
      this.sessionMemory = new SessionMemory(this.sessionId);
      this.suggestionEngine = new SuggestionEngine(this.sessionMemory);
      this.streamHandler = new StreamingHandler(this.providerManager);

      const converter = new CommandConverter(this.providerManager, this.sessionMemory);
      this.bridge = new AIExecutorBridge({
        converter,
        executor: (this.executorService as any).executor, // Access internal executor
        streamHandler: this.streamHandler,
        memory: this.sessionMemory,
        sessionId: this.sessionId,
      });

      this.macroEngine = new MacroEngine(this.sessionMemory, {
        detectionThreshold: this.config.macroThreshold || 3,
        persistMacros: true,
      });

      logger.info("AI components initialized successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to initialize AI components");
      throw error;
    }
  }

  /**
   * Get suggestions for user input
   */
  async getSuggestions(input: string): Promise<Suggestion[]> {
    if (!this.suggestionEngine || !this.sessionMemory) {
      return [];
    }

    try {
      return await this.suggestionEngine.generateSuggestions(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message }, "Failed to generate suggestions");
      return [];
    }
  }

  /**
   * Execute command using AI conversion (natural language to command)
   */
  async executeAIRequest(
    request: string,
    workingDir: string,
    onStream?: StreamCallback
  ): Promise<AIExecutionResult> {
    if (!this.bridge) {
      return {
        success: false,
        command: request,
        output: "",
        error: "AI executor bridge not initialized",
        isUnsafe: false,
        confidence: 0,
        tokens: 0,
        cost: 0,
      };
    }

    try {
      const result = await this.bridge.executeAIRequest(
        request,
        workingDir,
        onStream
      );

      // Track for macro detection
      if (this.macroEngine && result.success) {
        this.macroEngine.recordCommand(result.command);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "AI execution failed");

      return {
        success: false,
        command: request,
        output: "",
        error: message,
        isUnsafe: false,
        confidence: 0,
        tokens: 0,
        cost: 0,
      };
    }
  }

  /**
   * Execute standard tool command (existing functionality)
   */
  async executeCommand(
    input: string,
    sessionId: string,
    workingDir?: string
  ) {
    const result = await this.executorService.executeCommand(
      input,
      sessionId,
      workingDir
    );

    // Track for macro detection
    if (this.macroEngine && result.success) {
      this.macroEngine.recordCommand(input);
    }

    return result;
  }

  /**
   * Get detected macro sequences
   */
  async getDetectedSequences() {
    if (!this.macroEngine) {
      return [];
    }
    return this.macroEngine.getDetectedSequences();
  }

  /**
   * Create a macro from sequence
   */
  async createMacro(name: string, commands: string[], description?: string) {
    if (!this.macroEngine) {
      throw new Error("Macro engine not initialized");
    }
    return await this.macroEngine.createMacro(name, commands, description);
  }

  /**
   * Get all macros
   */
  async getMacros() {
    if (!this.macroEngine) {
      return [];
    }
    return await this.macroEngine.getMacros();
  }

  /**
   * Execute a macro
   */
  async executeMacro(name: string) {
    if (!this.macroEngine) {
      throw new Error("Macro engine not initialized");
    }
    return await this.macroEngine.executeMacro(name);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    if (!this.bridge) {
      return { totalTokens: 0, totalCost: 0, successRate: 0 };
    }
    return this.bridge.getSessionStats();
  }

  /**
   * Check if AI is connected and ready
   */
  isAIReady(): boolean {
    return !!this.bridge && !!this.suggestionEngine;
  }

  /**
   * Handle built-in commands (inherited from ExecutorService)
   */
  async handleBuiltInCommand(input: string, sessionId: string) {
    return await (this.executorService as any).handleBuiltInCommand(input, sessionId);
  }
}

/**
 * Factory function
 */
let serviceInstance: AIExecutorService | null = null;

export function getAIExecutorService(
  config: AIExecutorServiceConfig,
  sessionId: string
): AIExecutorService {
  if (!serviceInstance) {
    serviceInstance = new AIExecutorService(config, sessionId);
  }
  return serviceInstance;
}

export function resetAIExecutorService(): void {
  serviceInstance = null;
}
