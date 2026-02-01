/**
 * Tool Registry System
 */

import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@/types";
import { createLogger } from "@/utils/logger";
import { ToolError, ValidationError } from "@/utils/error-handler";

const logger = createLogger("tool-registry");

/**
 * Built-in tools
 */
const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  "file-read": {
    id: "file-read",
    name: "Read File",
    description: "Read contents of a file",
    version: "1.0.0",
    category: "file",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Path to the file to read",
        required: true,
      },
    ],
    permissions: ["fs:read"],
    examples: ["file-read ./README.md", "file-read ./src/main.ts"],
  },

  "file-write": {
    id: "file-write",
    name: "Write File",
    description: "Write contents to a file",
    version: "1.0.0",
    category: "file",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Path to the file to write",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Content to write to the file",
        required: true,
      },
    ],
    permissions: ["fs:write"],
    examples: ["file-write ./output.txt 'Hello World'"],
  },

  "list-dir": {
    id: "list-dir",
    name: "List Directory",
    description: "List files in a directory",
    version: "1.0.0",
    category: "file",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Path to the directory",
        required: false,
        default: ".",
      },
    ],
    permissions: ["fs:read"],
    examples: ["list-dir", "list-dir ./src"],
  },
};

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executors: Map<string, (ctx: ToolExecutionContext, params: Record<string, unknown>) => Promise<ToolExecutionResult>> = new Map();

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltinTools() {
    for (const [id, tool] of Object.entries(BUILTIN_TOOLS)) {
      this.tools.set(id, tool);
      logger.debug({ toolId: id }, "Registered built-in tool");
    }
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: ToolDefinition, executor?: (ctx: ToolExecutionContext, params: Record<string, unknown>) => Promise<ToolExecutionResult>) {
    if (this.tools.has(tool.id)) {
      throw new ToolError(`Tool with id "${tool.id}" is already registered`);
    }

    this.tools.set(tool.id, tool);

    if (executor) {
      this.executors.set(tool.id, executor);
    }

    logger.info({ toolId: tool.id }, "Registered custom tool");
  }

  /**
   * Get tool definition
   */
  getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  /**
   * List all available tools
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools by category
   */
  listToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((tool) => tool.category === category);
  }

  /**
   * Validate tool parameters
   */
  validateToolParameters(toolId: string, params: Record<string, unknown>): boolean {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new ValidationError(`Tool "${toolId}" not found`);
    }

    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        throw new ValidationError(`Missing required parameter: ${param.name}`);
      }

      if (param.name in params) {
        const value = params[param.name];
        if (typeof value !== param.type) {
          throw new ValidationError(`Parameter "${param.name}" has invalid type. Expected ${param.type}, got ${typeof value}`);
        }
      }
    }

    return true;
  }

  /**
   * Execute a tool (stub for Phase 2)
   */
  async executeTool(toolId: string, context: ToolExecutionContext, params: Record<string, unknown>): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const tool = this.getTool(toolId);
      if (!tool) {
        return {
          success: false,
          error: `Tool "${toolId}" not found`,
          executionTime: Date.now() - startTime,
        };
      }

      this.validateToolParameters(toolId, params);

      const executor = this.executors.get(toolId);
      if (!executor) {
        logger.warn({ toolId }, "No executor registered for tool");
        return {
          success: true,
          data: {
            message: `[Mock] Tool "${tool.name}" would execute with params: ${JSON.stringify(params)}`,
            note: "Real tool execution coming in Phase 2",
          },
          executionTime: Date.now() - startTime,
        };
      }

      const result = await executor(context, params);
      logger.info({ toolId, executionTime: result.executionTime }, "Tool executed");

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ toolId, error: message }, "Tool execution failed");

      return {
        success: false,
        error: message,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

/**
 * Global registry instance
 */
let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetToolRegistry() {
  globalRegistry = null;
}
