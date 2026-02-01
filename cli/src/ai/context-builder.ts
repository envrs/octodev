import { ToolExecutionResult, ExecutionContext } from "@/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("context-builder");

/**
 * Represents a single execution record for context
 */
export interface ExecutionRecord {
  toolName: string;
  command: string;
  result: ToolExecutionResult;
  timestamp: Date;
  duration: number;
}

/**
 * Context object passed to AI for decision making
 */
export interface AIContext {
  systemPrompt: string;
  userContext: string;
  toolDescriptions: string;
  recentExecutions: ExecutionRecord[];
  currentDirectory: string;
  availableTools: string[];
  sessionHistory: string[];
  tokenCount: number;
}

/**
 * Context builder for constructing optimized prompts
 */
export class ContextBuilder {
  private maxContextTokens = 2000; // Reserve for user input and response
  private maxExecutionHistory = 100;
  private recentExecutions: ExecutionRecord[] = [];
  private sessionHistory: string[] = [];

  constructor(
    private availableTools: string[],
    private toolDescriptions: Map<string, string>
  ) {}

  /**
   * Add execution record to context
   */
  addExecution(record: ExecutionRecord): void {
    this.recentExecutions.unshift(record); // Add to front (most recent first)

    if (this.recentExecutions.length > this.maxExecutionHistory) {
      this.recentExecutions = this.recentExecutions.slice(0, this.maxExecutionHistory);
    }

    logger.debug(
      { tool: record.toolName, success: record.result.success },
      "Added execution to context"
    );
  }

  /**
   * Add user message to session history
   */
  addToHistory(message: string): void {
    this.sessionHistory.push(message);
    if (this.sessionHistory.length > 50) {
      this.sessionHistory = this.sessionHistory.slice(-50);
    }
  }

  /**
   * Build complete context for AI
   */
  buildContext(
    userInput: string,
    currentDirectory: string
  ): AIContext {
    const toolDescriptions = this.buildToolDescriptions();
    const recentExecutionSummary = this.buildExecutionSummary();
    const sessionSummary = this.buildSessionSummary();

    const userContext = `
Current Directory: ${currentDirectory}
Recent Session: ${sessionSummary}
Recent Executions: ${recentExecutionSummary}
User Input: ${userInput}
`.trim();

    const systemPrompt = `You are an intelligent CLI assistant helping users execute development tools and commands.

Available Tools:
${toolDescriptions}

Guidelines:
- Understand user intent and suggest appropriate tools
- Generate precise, safe commands for execution
- Explain your suggestions clearly
- Consider the context of recent executions
- Always prioritize security and user intent clarity
- When suggesting multi-step commands, explain each step
- If a command might be destructive, ask for confirmation`;

    const context: AIContext = {
      systemPrompt,
      userContext,
      toolDescriptions,
      recentExecutions: this.recentExecutions.slice(0, 50), // Last 50 for token efficiency
      currentDirectory,
      availableTools: this.availableTools,
      sessionHistory: this.sessionHistory.slice(-20), // Last 20 messages
      tokenCount: this.estimateTokens(systemPrompt + userContext),
    };

    logger.debug(
      { tokenCount: context.tokenCount, executions: context.recentExecutions.length },
      "Built AI context"
    );

    return context;
  }

  /**
   * Build tool descriptions section
   */
  private buildToolDescriptions(): string {
    const descriptions = this.availableTools
      .map((tool) => {
        const desc = this.toolDescriptions.get(tool) || "No description available";
        return `- ${tool}: ${desc}`;
      })
      .join("\n");

    return descriptions || "No tools available";
  }

  /**
   * Summarize recent executions
   */
  private buildExecutionSummary(): string {
    if (this.recentExecutions.length === 0) {
      return "No recent executions";
    }

    const summary = this.recentExecutions
      .slice(0, 10)
      .map((exec) => {
        const status = exec.result.success ? "✓" : "✗";
        return `${status} ${exec.toolName}: ${exec.command} (${exec.duration}ms)`;
      })
      .join("\n");

    return summary;
  }

  /**
   * Summarize session history
   */
  private buildSessionSummary(): string {
    if (this.sessionHistory.length === 0) {
      return "No session history";
    }

    return this.sessionHistory
      .slice(-5)
      .map((msg) => msg.substring(0, 100))
      .join(" → ");
  }

  /**
   * Rough token estimation (1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear history (useful for session resets)
   */
  clear(): void {
    this.recentExecutions = [];
    this.sessionHistory = [];
    logger.debug("Cleared context");
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
  } {
    if (this.recentExecutions.length === 0) {
      return { totalExecutions: 0, successRate: 0, averageDuration: 0 };
    }

    const successful = this.recentExecutions.filter((e) => e.result.success).length;
    const avgDuration = this.recentExecutions.reduce((sum, e) => sum + e.duration, 0) / this.recentExecutions.length;

    return {
      totalExecutions: this.recentExecutions.length,
      successRate: (successful / this.recentExecutions.length) * 100,
      averageDuration: avgDuration,
    };
  }
}
