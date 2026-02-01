import { EventEmitter } from "events";
import { LanguageModel } from "ai";

/**
 * AI Provider interface for abstraction over multiple LLM providers
 */
export interface AIProvider {
  name: string;
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getModel(): LanguageModel;
  testConnection(): Promise<boolean>;
}

/**
 * Streaming handler for real-time token processing
 */
export interface StreamingHandler {
  on(event: "token", listener: (token: string) => void): this;
  on(event: "complete", listener: (fullText: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  emit(event: "token", token: string): boolean;
  emit(event: "complete", fullText: string): boolean;
  emit(event: "error", error: Error): boolean;
}

/**
 * AI Response structure with metadata
 */
export interface AIResponse {
  content: string;
  tokens: {
    input: number;
    output: number;
  };
  finishReason: "stop" | "length" | "error" | "tool-calls" | "content-filter";
  metadata?: {
    model: string;
    provider: string;
    timestamp: Date;
    duration: number; // milliseconds
  };
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: "openai" | "anthropic" | "cohere" | "bedrock";
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * Base class for AI providers with common functionality
 */
export abstract class BaseAIProvider extends EventEmitter implements AIProvider {
  abstract name: string;
  protected initialized = false;
  protected model: LanguageModel | null = null;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
  }

  abstract initialize(): Promise<void>;

  isInitialized(): boolean {
    return this.initialized;
  }

  getModel(): LanguageModel {
    if (!this.model) {
      throw new Error(`${this.name} provider not initialized`);
    }
    return this.model;
  }

  abstract testConnection(): Promise<boolean>;

  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}
