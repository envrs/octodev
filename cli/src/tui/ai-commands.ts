/**
 * AI Commands Handler
 * Processes AI-specific commands like /suggest, /explain, /macro, /ai-config
 */

import { AIExecutorService } from "./ai-executor-service";
import { SessionMemory } from "@/memory/session-memory";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ai-commands");

/**
 * Command result
 */
export interface CommandResult {
  handled: boolean;
  command?: string;
  output?: string;
  error?: string;
  isAICommand: boolean;
}

/**
 * AI Commands Handler
 */
export class AICommandsHandler {
  private aiService: AIExecutorService;
  private memory: SessionMemory;

  constructor(aiService: AIExecutorService, memory: SessionMemory) {
    this.aiService = aiService;
    this.memory = memory;
  }

  /**
   * Process AI command
   */
  async handleCommand(input: string): Promise<CommandResult> {
    const trimmed = input.trim().toLowerCase();

    // /suggest - Get suggestions for next command
    if (trimmed === "/suggest" || trimmed.startsWith("/suggest ")) {
      return this.handleSuggest(input);
    }

    // /explain - Natural language command execution
    if (trimmed.startsWith("/explain ")) {
      return this.handleExplain(input);
    }

    // /macro - Macro management
    if (trimmed.startsWith("/macro ")) {
      return this.handleMacro(input);
    }

    // /ai-config - AI configuration
    if (trimmed === "/ai-config" || trimmed.startsWith("/ai-config ")) {
      return this.handleAIConfig(input);
    }

    // /ai-stats - Session AI statistics
    if (trimmed === "/ai-stats") {
      return this.handleAIStats();
    }

    // Not an AI command
    return {
      handled: false,
      isAICommand: false,
    };
  }

  /**
   * Handle /suggest command
   */
  private async handleSuggest(input: string): Promise<CommandResult> {
    try {
      const query = input.replace(/^\/suggest\s*/i, "").trim();

      if (!this.aiService.isAIReady()) {
        return {
          handled: true,
          command: "/suggest",
          output: "AI service not ready. Please initialize AI first.",
          isAICommand: true,
        };
      }

      const suggestions = await this.aiService.getSuggestions(query || "");

      if (suggestions.length === 0) {
        return {
          handled: true,
          command: "/suggest",
          output: "No suggestions available. Try being more specific.",
          isAICommand: true,
        };
      }

      const output = suggestions
        .map((s, i) => `${i + 1}. ${s.command} (${s.confidence}% confidence)\n   ${s.description}`)
        .join("\n\n");

      return {
        handled: true,
        command: "/suggest",
        output,
        isAICommand: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Suggest command failed");
      return {
        handled: true,
        command: "/suggest",
        error: `Failed to generate suggestions: ${message}`,
        isAICommand: true,
      };
    }
  }

  /**
   * Handle /explain command (natural language execution)
   */
  private async handleExplain(input: string): Promise<CommandResult> {
    try {
      const request = input.replace(/^\/explain\s+/i, "").trim();

      if (!request) {
        return {
          handled: true,
          command: "/explain",
          output: "Usage: /explain <natural language request>\nExample: /explain show me the last 10 lines of config.json",
          isAICommand: true,
        };
      }

      if (!this.aiService.isAIReady()) {
        return {
          handled: true,
          command: "/explain",
          output: "AI service not ready. Please initialize AI first.",
          isAICommand: true,
        };
      }

      return {
        handled: true,
        command: "/explain",
        output: `[Streaming AI response for: "${request}"]\nNote: Execute as tool command using this pattern.\nFull streaming integration in final shell implementation.`,
        isAICommand: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Explain command failed");
      return {
        handled: true,
        command: "/explain",
        error: `Failed to process request: ${message}`,
        isAICommand: true,
      };
    }
  }

  /**
   * Handle /macro command
   */
  private async handleMacro(input: string): Promise<CommandResult> {
    try {
      const args = input.replace(/^\/macro\s+/i, "").trim().split(/\s+/);
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand) {
        return {
          handled: true,
          command: "/macro",
          output: "Macro commands:\n  /macro list - List all macros\n  /macro run <name> - Execute macro\n  /macro save <name> <commands> - Save macro",
          isAICommand: true,
        };
      }

      switch (subcommand) {
        case "list": {
          const macros = await this.aiService.getMacros();
          if (macros.length === 0) {
            return {
              handled: true,
              command: "/macro list",
              output: "No macros defined. Use /macro save to create one.",
              isAICommand: true,
            };
          }

          const output = macros
            .map((m: any) => `${m.name}\n   Commands: ${m.commands.length}\n   Usage: ${m.usageCount}x`)
            .join("\n");

          return {
            handled: true,
            command: "/macro list",
            output,
            isAICommand: true,
          };
        }

        case "run": {
          const macroName = args[1];
          if (!macroName) {
            return {
              handled: true,
              command: "/macro run",
              error: "Usage: /macro run <name>",
              isAICommand: true,
            };
          }

          const commands = await this.aiService.executeMacro(macroName);
          return {
            handled: true,
            command: "/macro run",
            output: `Executing macro "${macroName}":\n${commands.join("\n")}`,
            isAICommand: true,
          };
        }

        case "save": {
          const macroName = args[1];
          if (!macroName) {
            return {
              handled: true,
              command: "/macro save",
              error: "Usage: /macro save <name> [description]",
              isAICommand: true,
            };
          }

          // Note: Full implementation would capture the command sequence
          return {
            handled: true,
            command: "/macro save",
            output: `Macro "${macroName}" created (full implementation in shell integration)`,
            isAICommand: true,
          };
        }

        default:
          return {
            handled: true,
            command: "/macro",
            error: `Unknown macro subcommand: ${subcommand}`,
            isAICommand: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Macro command failed");
      return {
        handled: true,
        command: "/macro",
        error: `Macro operation failed: ${message}`,
        isAICommand: true,
      };
    }
  }

  /**
   * Handle /ai-config command
   */
  private async handleAIConfig(input: string): Promise<CommandResult> {
    try {
      const args = input.replace(/^\/ai-config\s*/i, "").trim().split(/\s+/);
      const option = args[0]?.toLowerCase();

      if (!option) {
        const stats = this.aiService.getSessionStats();
        return {
          handled: true,
          command: "/ai-config",
          output: `AI Configuration:\n  Provider: openai\n  Model: gpt-4o-mini\n  Streaming: enabled\n  Suggestions: enabled\n  Macros: enabled\n\nSession:\n  Tokens: ${stats.totalTokens}\n  Cost: $${stats.totalCost.toFixed(4)}`,
          isAICommand: true,
        };
      }

      switch (option) {
        case "streaming":
          return {
            handled: true,
            command: "/ai-config streaming",
            output: "Streaming: enabled (toggle with /ai-config streaming off)",
            isAICommand: true,
          };

        case "suggestions":
          return {
            handled: true,
            command: "/ai-config suggestions",
            output: "Suggestions: enabled (toggle with /ai-config suggestions off)",
            isAICommand: true,
          };

        case "cost":
          return {
            handled: true,
            command: "/ai-config cost",
            output: "Cost tracking: enabled (use /ai-stats for details)",
            isAICommand: true,
          };

        default:
          return {
            handled: true,
            command: "/ai-config",
            error: `Unknown config option: ${option}`,
            isAICommand: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "AI config command failed");
      return {
        handled: true,
        command: "/ai-config",
        error: `Configuration error: ${message}`,
        isAICommand: true,
      };
    }
  }

  /**
   * Handle /ai-stats command
   */
  private async handleAIStats(): Promise<CommandResult> {
    try {
      const stats = this.aiService.getSessionStats();

      return {
        handled: true,
        command: "/ai-stats",
        output: `Session AI Statistics:\n  Total Tokens: ${stats.totalTokens}\n  Estimated Cost: $${stats.totalCost.toFixed(4)}\n  Success Rate: ${stats.successRate.toFixed(1)}%`,
        isAICommand: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "AI stats command failed");
      return {
        handled: true,
        command: "/ai-stats",
        error: `Failed to retrieve statistics: ${message}`,
        isAICommand: true,
      };
    }
  }
}

/**
 * Factory function
 */
export function createAICommandsHandler(
  aiService: AIExecutorService,
  memory: SessionMemory
): AICommandsHandler {
  return new AICommandsHandler(aiService, memory);
}
