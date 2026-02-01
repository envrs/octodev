import { openai } from "@ai-sdk/openai";
import { BaseAIProvider, ProviderConfig, AIResponse } from "@/ai/provider";
import { generateText } from "ai";
import { createLogger } from "@/utils/logger";

const logger = createLogger("openai-provider");

export class OpenAIProvider extends BaseAIProvider {
  name = "openai";

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("OpenAI provider already initialized");
      return;
    }

    if (!this.config.apiKey) {
      throw new Error("OpenAI API key not provided");
    }

    try {
      this.model = openai(this.config.model);
      logger.debug({ model: this.config.model }, "Initialized OpenAI provider");
      this.initialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to initialize OpenAI provider");
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await generateText({
        model: this.getModel(),
        prompt: "Say 'OK' if you can hear me.",
        maxTokens: 10,
      });

      logger.debug({ content: result.text }, "OpenAI connection test successful");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "OpenAI connection test failed");
      return false;
    }
  }

  async generateResponse(
    prompt: string,
    systemPrompt?: string
  ): Promise<AIResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const result = await generateText({
        model: this.getModel(),
        prompt,
        system: systemPrompt,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 4096,
        topP: this.config.topP ?? 1,
      });

      const duration = Date.now() - startTime;

      const response: AIResponse = {
        content: result.text,
        tokens: {
          input: result.usage?.promptTokens ?? 0,
          output: result.usage?.completionTokens ?? 0,
        },
        finishReason: (result.finishReason as any) ?? "stop",
        metadata: {
          model: this.config.model,
          provider: this.name,
          timestamp: new Date(),
          duration,
        },
      };

      logger.debug(
        {
          tokens: response.tokens,
          duration,
        },
        "OpenAI response generated"
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "OpenAI generation failed");
      throw error;
    }
  }

  async *streamResponse(
    prompt: string,
    systemPrompt?: string
  ): AsyncGenerator<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { textStream } = await (this.getModel() as any).doStream({
        prompt,
        system: systemPrompt,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 4096,
        topP: this.config.topP ?? 1,
      });

      for await (const token of textStream) {
        yield token;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "OpenAI streaming failed");
      throw error;
    }
  }
}
