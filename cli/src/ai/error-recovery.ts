/**
 * Error Recovery Engine
 * Uses AI to suggest recovery actions and learn from failures
 */

import { ProviderManager } from "@/ai/provider-manager";
import { SessionMemory } from "@/memory/session-memory";
import { createLogger } from "@/utils/logger";

const logger = createLogger("error-recovery");

/**
 * Error recovery suggestion
 */
export interface RecoverySuggestion {
  action: string;
  description: string;
  confidence: number;
  reasoning: string;
}

/**
 * Error context for recovery
 */
export interface ErrorContext {
  command: string;
  error: string;
  errorCode?: string;
  output?: string;
  tool?: string;
  previousAttempts?: number;
}

/**
 * Error Recovery Engine
 * Analyzes failures and suggests recovery actions
 */
export class ErrorRecoveryEngine {
  private providerManager: ProviderManager;
  private memory: SessionMemory;
  private failurePatterns: Map<string, { count: number; lastSeen: Date }> = new Map();

  constructor(providerManager: ProviderManager, memory: SessionMemory) {
    this.providerManager = providerManager;
    this.memory = memory;
  }

  /**
   * Analyze error and suggest recovery
   */
  async suggestRecovery(context: ErrorContext): Promise<RecoverySuggestion[]> {
    try {
      logger.debug({ command: context.command, error: context.error }, "Analyzing error for recovery");

      // Track failure pattern
      const patternKey = `${context.tool}:${context.errorCode || "unknown"}`;
      const pattern = this.failurePatterns.get(patternKey) || { count: 0, lastSeen: new Date() };
      pattern.count++;
      pattern.lastSeen = new Date();
      this.failurePatterns.set(patternKey, pattern);

      // Generate recovery suggestions based on error type
      const suggestions = await this.generateSuggestions(context);

      logger.debug({ count: suggestions.length }, "Recovery suggestions generated");
      return suggestions;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message }, "Error recovery analysis failed");
      return this.getGenericSuggestions(context);
    }
  }

  /**
   * Generate recovery suggestions based on error
   */
  private async generateSuggestions(context: ErrorContext): Promise<RecoverySuggestion[]> {
    const suggestions: RecoverySuggestion[] = [];

    // Common error patterns and their fixes
    if (context.error.toLowerCase().includes("not found") || context.error.toLowerCase().includes("no such")) {
      suggestions.push({
        action: 'Run "list-dir" to check if the file/directory exists',
        description: "Verify that the file or directory you're trying to access actually exists",
        confidence: 95,
        reasoning: "File/directory not found error typically means the path is incorrect or the resource doesn't exist",
      });
      suggestions.push({
        action: "Check the current working directory with pwd",
        description: "Ensure you're in the correct directory before accessing files",
        confidence: 85,
        reasoning: "Path issues are often resolved by verifying current location",
      });
      suggestions.push({
        action: "Try using an absolute path instead of a relative path",
        description: "Specify the full path from the root to avoid directory confusion",
        confidence: 80,
        reasoning: "Relative paths can be ambiguous; absolute paths are more explicit",
      });
    } else if (context.error.toLowerCase().includes("permission denied")) {
      suggestions.push({
        action: "Verify file permissions with file-stat",
        description: "Check if you have the necessary permissions to access this file",
        confidence: 95,
        reasoning: "Permission denied errors require checking current access levels",
      });
      suggestions.push({
        action: "Try accessing a different file or directory you have permission for",
        description: "Temporarily access a different resource to confirm permissions are the issue",
        confidence: 75,
        reasoning: "Isolating the issue helps verify it's a permissions problem",
      });
    } else if (context.error.toLowerCase().includes("timeout")) {
      suggestions.push({
        action: "Increase the command timeout and retry",
        description: "The command may need more time to complete",
        confidence: 90,
        reasoning: "Timeout errors suggest the operation is valid but slow",
      });
      suggestions.push({
        action: "Break the operation into smaller chunks",
        description: "Process data in smaller batches to avoid timeouts",
        confidence: 85,
        reasoning: "Large operations can be split into multiple smaller ones",
      });
    } else if (context.error.toLowerCase().includes("invalid") || context.error.toLowerCase().includes("syntax")) {
      suggestions.push({
        action: "Review the command syntax and parameters",
        description: "Check that all arguments are in the correct format",
        confidence: 95,
        reasoning: "Invalid syntax errors require correcting the command structure",
      });
      suggestions.push({
        action: "Simplify the command to its most basic form",
        description: "Test with minimal arguments first, then add complexity",
        confidence: 90,
        reasoning: "Starting simple helps identify which parameter is causing the issue",
      });
    } else if (context.error.toLowerCase().includes("unsafe") || context.error.toLowerCase().includes("not allowed")) {
      suggestions.push({
        action: "Use a safer alternative command or tool",
        description: "The attempted command has been blocked for safety reasons",
        confidence: 98,
        reasoning: "Unsafe commands cannot be executed; use alternatives instead",
      });
      suggestions.push({
        action: "Request access to the command in configuration",
        description: "Update the command whitelist if you have proper authorization",
        confidence: 70,
        reasoning: "Some commands may be whitelisted by administrators",
      });
    }

    // Check if this is a repeated failure pattern
    const patternKey = `${context.tool}:${context.errorCode || "unknown"}`;
    const pattern = this.failurePatterns.get(patternKey);
    if (pattern && pattern.count >= 3) {
      suggestions.push({
        action: "This error has occurred multiple times. Consider a different approach.",
        description: "If the same error keeps happening, try a fundamentally different strategy",
        confidence: 80,
        reasoning: "Repeated failures with the same approach suggest trying something new",
      });
    }

    return suggestions.length > 0 ? suggestions : this.getGenericSuggestions(context);
  }

  /**
   * Get generic recovery suggestions
   */
  private getGenericSuggestions(context: ErrorContext): RecoverySuggestion[] {
    return [
      {
        action: "Review the command syntax",
        description: "Ensure the command is correctly formatted",
        confidence: 70,
        reasoning: "Most errors result from command syntax issues",
      },
      {
        action: "Check available tools with the tools command",
        description: "Verify that the tool you want to use is available",
        confidence: 65,
        reasoning: "Ensuring the tool exists is a basic troubleshooting step",
      },
      {
        action: "Try a simpler version of the command",
        description: "Remove optional parameters and test with basic usage",
        confidence: 60,
        reasoning: "Simplification helps isolate the cause of the failure",
      },
      {
        action: "Review recent successful commands for patterns",
        description: "Compare with working commands to see what differs",
        confidence: 55,
        reasoning: "Similar successful commands can provide a working pattern",
      },
    ];
  }

  /**
   * Get failure statistics
   */
  getFailureStats() {
    return {
      totalPatterns: this.failurePatterns.size,
      patterns: Array.from(this.failurePatterns.entries()).map(([key, value]) => ({
        pattern: key,
        occurrences: value.count,
        lastSeen: value.lastSeen,
      })),
    };
  }

  /**
   * Clear failure history (e.g., at session end)
   */
  clearHistory(): void {
    this.failurePatterns.clear();
    logger.debug("Error recovery history cleared");
  }
}

/**
 * Factory function
 */
export function createErrorRecoveryEngine(
  providerManager: ProviderManager,
  memory: SessionMemory
): ErrorRecoveryEngine {
  return new ErrorRecoveryEngine(providerManager, memory);
}
