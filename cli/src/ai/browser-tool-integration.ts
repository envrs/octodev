/**
 * Browser Tool Integration for CLI Agent
 * 
 * Integrates browser tools into the CLI agent workflow, enabling
 * AI-driven browser automation and tool invocation.
 */

import { createLogger } from "@/utils/logger";
import { ValidationError, ToolError } from "@/utils/error-handler";
import { getExecutor, type ToolExecutionResult } from "@/tools/tool-executor";
import type { AIResponse } from "./provider";

const logger = createLogger("browser-tool-integration");

/**
 * Tool invocation request from AI
 */
export interface ToolInvocationRequest {
  toolName: string;
  params: Record<string, any>;
  reasoning: string;
  confidence: number;
}

/**
 * Tool invocation result with context
 */
export interface ToolInvocationResult {
  request: ToolInvocationRequest;
  result: ToolExecutionResult;
  formattedResult: string;
  shouldContinue: boolean;
}

/**
 * Browser tool integration service
 */
export class BrowserToolIntegration {
  private static instance: BrowserToolIntegration;
  private executor = getExecutor();
  private invocationHistory: ToolInvocationRequest[] = [];
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  static getInstance(): BrowserToolIntegration {
    if (!BrowserToolIntegration.instance) {
      BrowserToolIntegration.instance = new BrowserToolIntegration();
    }
    return BrowserToolIntegration.instance;
  }

  /**
   * Parse AI response for tool invocation requests
   */
  parseToolInvocations(aiResponse: AIResponse): ToolInvocationRequest[] {
    const invocations: ToolInvocationRequest[] = [];

    try {
      // Look for tool invocation markers in the response
      const toolBlocks = this.extractToolBlocks(aiResponse.content);

      for (const block of toolBlocks) {
        try {
          const invocation = this.parseToolBlock(block);
          if (invocation) {
            invocations.push(invocation);
          }
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error), block },
            "Failed to parse tool block"
          );
        }
      }

      if (invocations.length > 0) {
        logger.debug({ count: invocations.length }, "Found tool invocations in AI response");
      }

      return invocations;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to parse tool invocations"
      );
      return [];
    }
  }

  /**
   * Execute a tool invocation and format the result
   */
  async executeTool(invocation: ToolInvocationRequest): Promise<ToolInvocationResult> {
    logger.debug(
      { tool: invocation.toolName, reasoning: invocation.reasoning },
      "Executing tool invocation"
    );

    try {
      // Validate tool exists
      const tool = this.executor.getTool(invocation.toolName);

      // Execute the tool
      const result = await this.executor.execute({
        toolName: invocation.toolName,
        params: invocation.params,
        timeout: 30000,
        retryCount: 2,
      });

      // Format result for AI context
      const formattedResult = this.formatToolResult(result);

      // Determine if we should continue
      const shouldContinue = result.success || result.retries === undefined;

      this.invocationHistory.push(invocation);

      logger.info(
        { tool: invocation.toolName, success: result.success },
        "Tool execution completed"
      );

      return {
        request: invocation,
        result,
        formattedResult,
        shouldContinue,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { tool: invocation.toolName, error: errorMessage },
        "Tool execution failed"
      );

      const failureResult: ToolExecutionResult = {
        success: false,
        toolName: invocation.toolName,
        error: errorMessage,
        duration: 0,
      };

      return {
        request: invocation,
        result: failureResult,
        formattedResult: `Tool execution failed: ${errorMessage}`,
        shouldContinue: true,
      };
    }
  }

  /**
   * Execute multiple tool invocations sequentially
   */
  async executeSequence(invocations: ToolInvocationRequest[]): Promise<ToolInvocationResult[]> {
    const results: ToolInvocationResult[] = [];
    let consecutiveFailures = 0;

    for (const invocation of invocations) {
      const result = await this.executeTool(invocation);
      results.push(result);

      if (!result.result.success) {
        consecutiveFailures++;
        if (consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          logger.warn(
            { failures: consecutiveFailures },
            "Too many consecutive failures, stopping tool sequence"
          );
          break;
        }
      } else {
        consecutiveFailures = 0;
      }
    }

    return results;
  }

  /**
   * Build a system prompt that includes tool information
   */
  buildToolSystemPrompt(): string {
    const tools = this.executor.getAvailableTools();

    const toolsDescription = tools
      .map((tool) => {
        const params = tool.parameters
          .map((p) => `- ${p.name} (${p.type}): ${p.description}`)
          .join("\n");

        return `## ${tool.name}
Category: ${tool.category}
Description: ${tool.description}

Parameters:
${params}`;
      })
      .join("\n\n");

    return `You are an AI assistant with access to browser automation tools.

Available Tools:
${toolsDescription}

When you need to interact with the web or gather information, invoke tools using this format:
<tool name="toolName" params='{"param1": "value1", "param2": "value2"}' reasoning="Why you're using this tool"/>

Always provide clear reasoning for tool usage and format parameters as valid JSON.`;
  }

  /**
   * Get invocation history
   */
  getHistory(): ToolInvocationRequest[] {
    return [...this.invocationHistory];
  }

  /**
   * Clear invocation history
   */
  clearHistory(): void {
    this.invocationHistory = [];
  }

  /**
   * Get tool information for documentation
   */
  getToolDocumentation(): string {
    const tools = this.executor.getAvailableTools();

    let doc = "# Available Browser Tools\n\n";

    for (const tool of tools) {
      doc += `## ${tool.name}\n`;
      doc += `**Category:** ${tool.category}\n`;
      doc += `**Description:** ${tool.description}\n\n`;

      doc += "### Parameters\n";
      for (const param of tool.parameters) {
        const required = param.required ? "required" : "optional";
        doc += `- **${param.name}** (${param.type}, ${required}): ${param.description}\n`;
      }
      doc += "\n";
    }

    return doc;
  }

  /**
   * Private methods
   */

  private extractToolBlocks(content: string): string[] {
    const toolPattern = /<tool[^>]*>/g;
    const matches = content.match(toolPattern);
    return matches || [];
  }

  private parseToolBlock(block: string): ToolInvocationRequest | null {
    try {
      // Extract tool name
      const nameMatch = block.match(/name="([^"]+)"/);
      if (!nameMatch) return null;
      const toolName = nameMatch[1];

      // Extract params
      const paramsMatch = block.match(/params='([^']+)'/);
      const params = paramsMatch ? JSON.parse(paramsMatch[1]) : {};

      // Extract reasoning
      const reasoningMatch = block.match(/reasoning="([^"]+)"/);
      const reasoning = reasoningMatch ? reasoningMatch[1] : "No reasoning provided";

      return {
        toolName,
        params,
        reasoning,
        confidence: 85, // Default confidence
      };
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : String(error), block }, "Failed to parse tool block");
      return null;
    }
  }

  private formatToolResult(result: ToolExecutionResult): string {
    if (!result.success) {
      return `Tool execution failed: ${result.error || "Unknown error"}`;
    }

    if (!result.data) {
      return "Tool executed successfully but returned no data";
    }

    // Format different types of results
    if (typeof result.data === "string") {
      return result.data;
    }

    if (typeof result.data === "object") {
      // For web search results
      if ("query" in result.data && "results" in result.data) {
        const data = result.data as any;
        return `Search Results for "${data.query}":\n${JSON.stringify(data.results, null, 2)}`;
      }

      // For screenshot results
      if ("screenshot" in result.data) {
        const data = result.data as any;
        return `Screenshot taken successfully. URL: ${data.url}\nDimensions: ${data.width}x${data.height}`;
      }

      // For DOM inspection results
      if ("selector" in result.data && "elements" in result.data) {
        const data = result.data as any;
        return `Found ${data.count} elements matching selector "${data.selector}":\n${JSON.stringify(data.elements, null, 2)}`;
      }

      // For scraping results
      if ("selector" in result.data && "data" in result.data) {
        const data = result.data as any;
        return `Scraped ${data.count} items:\n${JSON.stringify(data.data, null, 2)}`;
      }

      // Default JSON formatting
      return JSON.stringify(result.data, null, 2);
    }

    return String(result.data);
  }
}

/**
 * Convenience function
 */
export function getBrowserToolIntegration(): BrowserToolIntegration {
  return BrowserToolIntegration.getInstance();
}
