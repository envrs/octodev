import { z } from "zod";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ai-config");

/**
 * AI Configuration Schema using Zod
 */
export const AIConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(["openai", "anthropic", "cohere", "bedrock"]).default("openai"),

  // Provider-specific configurations
  providers: z.object({
    openai: z.object({
      apiKey: z.string().min(1).optional(),
      model: z.string().default("gpt-4o-mini"),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(100).max(8000).default(4096),
      topP: z.number().min(0).max(1).default(1),
    }).default({}),

    anthropic: z.object({
      apiKey: z.string().min(1).optional(),
      model: z.string().default("claude-3-sonnet-20240229"),
      temperature: z.number().min(0).max(1).default(0.7),
      maxTokens: z.number().min(100).max(4096).default(2048),
    }).default({}),

    cohere: z.object({
      apiKey: z.string().min(1).optional(),
      model: z.string().default("command"),
      temperature: z.number().min(0).max(5).default(0.8),
      maxTokens: z.number().min(100).max(4096).default(2048),
    }).default({}),

    bedrock: z.object({
      region: z.string().default("us-east-1"),
      model: z.string().default("anthropic.claude-3-sonnet"),
    }).default({}),
  }).default({}),

  // Suggestions settings
  suggestions: z.object({
    enabled: z.boolean().default(true),
    count: z.number().min(1).max(5).default(3),
    showConfidence: z.boolean().default(true),
    minConfidence: z.number().min(0).max(100).default(50),
  }).default({}),

  // Streaming settings
  streaming: z.object({
    enabled: z.boolean().default(true),
    chunkSize: z.number().min(1).default(1),
    showSpinner: z.boolean().default(true),
    timeoutMs: z.number().min(1000).default(30000),
  }).default({}),

  // Memory settings
  memory: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().min(1).max(365).default(30),
    maxHistorySize: z.number().min(100).max(100000).default(10000),
    autoCleanup: z.boolean().default(true),
    dbPath: z.string().optional(),
  }).default({}),

  // Context settings
  context: z.object({
    maxExecutions: z.number().min(10).max(500).default(100),
    maxHistoryMessages: z.number().min(5).max(100).default(20),
    includeFileContext: z.boolean().default(true),
    includeDirectoryStructure: z.boolean().default(false),
  }).default({}),

  // Cost tracking
  costTracking: z.object({
    enabled: z.boolean().default(false),
    warningThreshold: z.number().default(10), // USD
    monthlyBudget: z.number().optional(),
  }).default({}),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AIConfig = AIConfigSchema.parse({});

/**
 * AI Configuration Manager
 */
export class AIConfigManager {
  private config: AIConfig;

  constructor(initialConfig?: Partial<AIConfig>) {
    try {
      this.config = AIConfigSchema.parse(initialConfig || {});
      logger.debug("AI config initialized");
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ issues: error.issues }, "AI config validation errors, using defaults");
      }
      this.config = DEFAULT_AI_CONFIG;
    }
  }

  /**
   * Get full config
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * Update partial config
   */
  updateConfig(updates: Partial<AIConfig>): void {
    try {
      this.config = AIConfigSchema.parse({ ...this.config, ...updates });
      logger.debug({ updates }, "AI config updated");
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ issues: error.issues }, "Invalid config update");
        throw new Error(`Invalid AI configuration: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if AI is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): string {
    return this.config.provider;
  }

  /**
   * Get provider config
   */
  getProviderConfig(): Record<string, any> {
    const provider = this.config.provider as keyof typeof this.config.providers;
    return this.config.providers[provider] || {};
  }

  /**
   * Get provider API key
   */
  getProviderApiKey(): string | undefined {
    const providerConfig = this.getProviderConfig() as any;
    return providerConfig.apiKey || process.env[`${this.config.provider.toUpperCase()}_API_KEY`];
  }

  /**
   * Validate provider configuration
   */
  validateProvider(): { valid: boolean; error?: string } {
    const apiKey = this.getProviderApiKey();

    if (!apiKey) {
      return {
        valid: false,
        error: `No API key configured for ${this.config.provider}. Set env var or config.`,
      };
    }

    return { valid: true };
  }

  /**
   * Get suggestions config
   */
  getSuggestionsConfig() {
    return this.config.suggestions;
  }

  /**
   * Get streaming config
   */
  getStreamingConfig() {
    return this.config.streaming;
  }

  /**
   * Get memory config
   */
  getMemoryConfig() {
    return this.config.memory;
  }

  /**
   * Get context config
   */
  getContextConfig() {
    return this.config.context;
  }

  /**
   * Export config as YAML-compatible object
   */
  toYAML(): Record<string, any> {
    return {
      ai: this.config,
    };
  }

  /**
   * Load from YAML object
   */
  static fromYAML(obj: any): AIConfigManager {
    const aiConfig = obj.ai || obj;
    return new AIConfigManager(aiConfig);
  }
}
