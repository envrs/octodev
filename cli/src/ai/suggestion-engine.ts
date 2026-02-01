import { AIProvider, AIResponse } from "@/ai/provider";
import { ContextBuilder, AIContext } from "@/ai/context-builder";
import { createLogger } from "@/utils/logger";

const logger = createLogger("suggestion-engine");

/**
 * Single suggestion with metadata
 */
export interface Suggestion {
  command: string;
  confidence: number; // 0-100
  explanation: string;
  steps?: string[]; // For multi-step commands
}

/**
 * Suggestion response from AI
 */
export interface SuggestionResponse {
  suggestions: Suggestion[];
  timestamp: Date;
  model: string;
  executionTime: number;
}

/**
 * Command suggestion engine powered by LLM
 */
export class SuggestionEngine {
  private suggestionPromptTemplate = `Based on the user's input and context, generate exactly 3 command suggestions.

Return your response in this exact JSON format:
{
  "suggestions": [
    {
      "command": "the actual command to execute",
      "confidence": 85,
      "explanation": "why this command is good for the user's request",
      "steps": ["optional", "multi-step", "breakdown"]
    }
  ]
}

User Request: {userInput}

Context:
{context}

Remember:
- Commands must be safe and valid
- Confidence should reflect how well it matches the request
- Always provide exactly 3 suggestions
- Include helpful explanations
- For complex tasks, break them into steps`;

  constructor(
    private aiProvider: AIProvider,
    private contextBuilder: ContextBuilder
  ) {}

  /**
   * Generate command suggestions based on user input
   */
  async generateSuggestions(
    userInput: string,
    currentDirectory: string
  ): Promise<SuggestionResponse> {
    const startTime = Date.now();
    this.contextBuilder.addToHistory(userInput);

    try {
      const context = this.contextBuilder.buildContext(userInput, currentDirectory);
      const prompt = this.suggestionPromptTemplate
        .replace("{userInput}", userInput)
        .replace("{context}", context.userContext);

      logger.debug({ input: userInput }, "Generating suggestions");

      const response = await this.aiProvider.generateResponse(prompt, context.systemPrompt);
      const suggestions = this.parseSuggestions(response.content);

      const result: SuggestionResponse = {
        suggestions: suggestions.length > 0 ? suggestions : this.getDefaultSuggestions(userInput),
        timestamp: new Date(),
        model: response.metadata?.model || "unknown",
        executionTime: Date.now() - startTime,
      };

      logger.debug(
        { count: result.suggestions.length, duration: result.executionTime },
        "Suggestions generated successfully"
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to generate suggestions");

      // Return default suggestions as fallback
      return {
        suggestions: this.getDefaultSuggestions(userInput),
        timestamp: new Date(),
        model: "fallback",
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse AI response into structured suggestions
   */
  private parseSuggestions(responseText: string): Suggestion[] {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn("No JSON found in response");
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = (parsed.suggestions || []) as Suggestion[];

      // Validate and normalize suggestions
      return suggestions
        .filter((s) => s.command && typeof s.confidence === "number")
        .slice(0, 3) // Ensure exactly 3
        .map((s) => ({
          ...s,
          confidence: Math.min(100, Math.max(0, s.confidence)),
        }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message }, "Failed to parse suggestions from AI response");
      return [];
    }
  }

  /**
   * Fallback suggestions based on input patterns
   */
  private getDefaultSuggestions(userInput: string): Suggestion[] {
    const lower = userInput.toLowerCase();

    const suggestions: Suggestion[] = [];

    // Pattern-based suggestions
    if (
      lower.includes("list") ||
      lower.includes("show") ||
      lower.includes("dir")
    ) {
      suggestions.push({
        command: "list-dir .",
        confidence: 60,
        explanation: "List files in current directory",
      });
    }

    if (lower.includes("read") || lower.includes("view") || lower.includes("cat")) {
      suggestions.push({
        command: "file-read ./",
        confidence: 55,
        explanation: "Read a file from current directory",
      });
    }

    if (lower.includes("create") || lower.includes("write") || lower.includes("make")) {
      suggestions.push({
        command: "file-write ./newfile",
        confidence: 50,
        explanation: "Create a new file",
      });
    }

    // If we have suggestions, return them; otherwise return generic help
    if (suggestions.length > 0) {
      return suggestions.slice(0, 3);
    }

    return [
      {
        command: "help",
        confidence: 40,
        explanation: "Get help on available tools and commands",
      },
      {
        command: "tools",
        confidence: 35,
        explanation: "List all available tools",
      },
      {
        command: "status",
        confidence: 30,
        explanation: "Check CLI status and configuration",
      },
    ];
  }

  /**
   * Get suggestion with visual confidence indicator
   */
  static formatSuggestion(suggestion: Suggestion): string {
    const confidenceBar = this.getConfidenceBar(suggestion.confidence);
    const steps = suggestion.steps
      ? `\n    Steps: ${suggestion.steps.join(" → ")}`
      : "";

    return `${confidenceBar} ${suggestion.confidence}%
    Command: ${suggestion.command}
    Reason: ${suggestion.explanation}${steps}`;
  }

  /**
   * Visual confidence bar
   */
  private static getConfidenceBar(confidence: number): string {
    const filled = Math.round(confidence / 10);
    const empty = 10 - filled;
    return `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
  }
}
