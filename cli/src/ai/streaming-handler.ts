import { AIProvider } from "@/ai/provider";
import { ContextBuilder } from "@/ai/context-builder";
import { EventEmitter } from "events";
import { createLogger } from "@/utils/logger";

const logger = createLogger("streaming-handler");

/**
 * Streaming response handler with buffering and event emission
 */
export class StreamingHandler extends EventEmitter {
  private buffer: string = "";
  private isStreaming: boolean = false;
  private abortController: AbortController | null = null;
  private chunkSize: number = 1; // Emit token by token for TUI

  constructor(
    private aiProvider: AIProvider,
    private contextBuilder: ContextBuilder
  ) {
    super();
  }

  /**
   * Stream a response and emit tokens in real-time
   */
  async stream(
    userInput: string,
    currentDirectory: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    if (this.isStreaming) {
      throw new Error("Already streaming");
    }

    this.isStreaming = true;
    this.buffer = "";
    this.abortController = new AbortController();

    const startTime = Date.now();
    const context = this.contextBuilder.buildContext(userInput, currentDirectory);

    logger.debug({ input: userInput }, "Starting stream");

    try {
      // Stream from provider (OpenAI provider's streamResponse)
      const stream = (this.aiProvider as any).streamResponse(
        userInput,
        context.systemPrompt
      );

      for await (const token of stream) {
        if (this.abortController?.signal.aborted) {
          logger.debug("Stream aborted by user");
          break;
        }

        this.buffer += token;
        this.emit("token", token);

        if (onToken) {
          onToken(token);
        }

        // Small delay to make streaming visible in TUI
        await this.delay(5);
      }

      const duration = Date.now() - startTime;

      this.emit("complete", this.buffer);
      logger.debug(
        { duration, tokenCount: this.buffer.length },
        "Stream completed"
      );

      return this.buffer;
    } catch (error) {
      if (error instanceof Error && error.message.includes("AbortError")) {
        logger.info("Stream was cancelled");
        this.emit("cancelled", this.buffer);
        return this.buffer;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Stream error");
      this.emit("error", error);
      throw error;
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /**
   * Stop the current stream
   */
  cancel(): void {
    if (this.abortController && this.isStreaming) {
      logger.debug("Cancelling stream");
      this.abortController.abort();
    }
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Check if currently streaming
   */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Set chunk size (for testing)
   */
  setChunkSize(size: number): void {
    this.chunkSize = Math.max(1, size);
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = "";
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format streaming response for TUI display
   */
  static formatStreamingResponse(content: string): string {
    // Clean up response
    let formatted = content.trim();

    // Remove common AI response artifacts
    formatted = formatted
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/^```[\s\S]*?\n/, "") // Remove opening markdown code block
      .replace(/\n```$/, ""); // Remove closing markdown code block

    return formatted;
  }
}

/**
 * TUI streaming manager for displaying tokens in real-time
 */
export class TUIStreamingManager {
  private handler: StreamingHandler | null = null;
  private displayBuffer: string = "";
  private maxDisplayLength: number = 1000; // For TUI output

  constructor(private chunkSize: number = 1) {}

  /**
   * Initialize streaming for a response
   */
  initialize(
    handler: StreamingHandler,
    onTokenDisplay?: (token: string, accumulated: string) => void
  ): void {
    this.handler = handler;
    this.displayBuffer = "";

    handler.on("token", (token: string) => {
      this.displayBuffer += token;

      // Truncate for display if needed
      const displayText =
        this.displayBuffer.length > this.maxDisplayLength
          ? "..." + this.displayBuffer.slice(-this.maxDisplayLength)
          : this.displayBuffer;

      if (onTokenDisplay) {
        onTokenDisplay(token, displayText);
      }
    });

    handler.on("complete", () => {
      logger.debug("Stream display complete");
    });

    handler.on("error", (error: Error) => {
      logger.error({ error: error.message }, "Stream display error");
    });
  }

  /**
   * Get current display buffer
   */
  getDisplayBuffer(): string {
    return this.displayBuffer;
  }

  /**
   * Format display output with visual indicators
   */
  static formatForDisplay(
    accumulated: string,
    isStreaming: boolean = false
  ): string {
    const cursor = isStreaming ? "▌" : "";
    return accumulated + cursor;
  }

  /**
   * Add visual loading indicator
   */
  static getLoadingIndicator(frames: string[] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]): string {
    const frame = Math.floor((Date.now() / 100) % frames.length);
    return frames[frame];
  }

  /**
   * Get streaming status message
   */
  static getStatusMessage(tokenCount: number, duration: number): string {
    const tokensPerSecond = Math.round((tokenCount / duration) * 1000);
    return `[Streaming: ${tokenCount} tokens, ${tokensPerSecond} t/s]`;
  }
}
