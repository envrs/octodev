import { AIProvider } from "@/ai/provider";
import { ContextBuilder } from "@/ai/context-builder";
import { createLogger } from "@/utils/logger";
import { ToolRegistry } from "@/tools/registry";

const logger = createLogger("command-converter");

/**
 * Converted command representation
 */
export interface ConvertedCommand {
  tool: string;
  args: Record<string, string | boolean>;
  explanation: string;
  rawCommand: string;
  confidence: number; // 0-100
  requiresConfirmation: boolean;
}

/**
 * Natural language to tool command converter
 */
export class CommandConverter {
  private conversionPromptTemplate = `You are an expert at converting natural language requests into CLI tool commands.

Available Tools:
{toolDescriptions}

Convert the user's request into a command. Return ONLY a valid JSON object:
{
  "tool": "tool-name",
  "args": {"arg1": "value1", "arg2": true},
  "explanation": "brief explanation of what this command does",
  "confidence": 85,
  "requiresConfirmation": false
}

User Request: {userInput}

Context:
- Current Directory: {currentDirectory}
- Available Tools: {availableTools}

Important Rules:
1. Use only available tools
2. Return valid JSON only
3. Set requiresConfirmation to true if command might modify files
4. Include file paths as needed
5. Set confidence 0-100 based on how well it matches the request`;

  constructor(
    private aiProvider: AIProvider,
    private contextBuilder: ContextBuilder,
    private toolRegistry: ToolRegistry
  ) {}

  /**
   * Convert natural language to command
   */
  async convert(
    userInput: string,
    currentDirectory: string
  ): Promise<ConvertedCommand> {
    logger.debug({ input: userInput }, "Converting natural language to command");

    try {
      const toolDescriptions = this.buildToolDescriptions();
      const availableTools = this.toolRegistry.getAllTools().map((t) => t.name);

      const prompt = this.conversionPromptTemplate
        .replace("{toolDescriptions}", toolDescriptions)
        .replace("{userInput}", userInput)
        .replace("{currentDirectory}", currentDirectory)
        .replace("{availableTools}", availableTools.join(", "));

      const systemPrompt = `You are a CLI command converter. Convert natural language to structured tool commands. Return only valid JSON.`;

      const response = await this.aiProvider.generateResponse(prompt, systemPrompt);
      const converted = this.parseConvertedCommand(response.content, userInput);

      logger.debug(
        { tool: converted.tool, confidence: converted.confidence },
        "Command converted successfully"
      );

      return converted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to convert command");

      // Return a safe fallback command
      return {
        tool: "help",
        args: {},
        explanation: `Unable to parse request: "${userInput}". Use 'help' to see available commands.`,
        rawCommand: userInput,
        confidence: 0,
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Parse AI response into ConvertedCommand
   */
  private parseConvertedCommand(
    responseText: string,
    originalInput: string
  ): ConvertedCommand {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate tool exists
      if (!parsed.tool) {
        throw new Error("No tool specified in response");
      }

      const tool = this.toolRegistry.getTool(parsed.tool);
      if (!tool) {
        throw new Error(`Tool '${parsed.tool}' not found`);
      }

      // Build raw command for display
      const args = parsed.args || {};
      const argsStr = Object.entries(args)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const rawCommand = `${parsed.tool} ${argsStr}`.trim();

      return {
        tool: parsed.tool,
        args,
        explanation: parsed.explanation || "Execute command",
        rawCommand,
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        requiresConfirmation: parsed.requiresConfirmation === true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        { error: message, response: responseText.substring(0, 200) },
        "Failed to parse converted command"
      );

      // Return help as safe fallback
      return {
        tool: "help",
        args: {},
        explanation: `Could not parse your request. Please try: "${originalInput}"`,
        rawCommand: originalInput,
        confidence: 0,
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Build tool descriptions for prompt
   */
  private buildToolDescriptions(): string {
    const tools = this.toolRegistry.getAllTools();
    return tools
      .map(
        (tool) =>
          `- ${tool.name}: ${tool.description || "No description"}\n  Args: ${Object.keys(tool.parameters)
            .join(", ") || "none"}`
      )
      .join("\n");
  }

  /**
   * Validate converted command before execution
   */
  validateCommand(command: ConvertedCommand): { valid: boolean; error?: string } {
    try {
      const tool = this.toolRegistry.getTool(command.tool);
      if (!tool) {
        return { valid: false, error: `Tool '${command.tool}' not found` };
      }

      // Check required parameters
      for (const [key, param] of Object.entries(tool.parameters)) {
        if (param.required && !(key in command.args)) {
          return {
            valid: false,
            error: `Missing required parameter: ${key}`,
          };
        }
      }

      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: message };
    }
  }

  /**
   * Format command for display
   */
  static formatCommand(command: ConvertedCommand): string {
    const confirmIcon = command.requiresConfirmation ? "⚠️ " : "→ ";
    const confidenceBar = `[${"█".repeat(Math.round(command.confidence / 10))}${ " ".repeat(10 - Math.round(command.confidence / 10))}]`;

    return `${confirmIcon}${confidenceBar} ${command.confidence}%
  Tool: ${command.tool}
  Command: ${command.rawCommand}
  Reason: ${command.explanation}`;
  }
}
