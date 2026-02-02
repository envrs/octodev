/**
 * Browser Tools Command
 * 
 * CLI command for invoking and testing browser tools
 */

import { Program } from "commander";
import { createLogger } from "@/utils/logger";
import { getBrowserToolIntegration } from "@/ai/browser-tool-integration";
import { getExecutor } from "@/tools/tool-executor";
import type { BrowserToolParams } from "@/tools/browser-tools";

const logger = createLogger("browser-tools-command");

export function registerBrowserToolsCommand(program: Program): void {
  const browserToolsCommand = program
    .command("tools")
    .description("Browser tools management and execution");

  // List available tools
  browserToolsCommand
    .command("list")
    .description("List all available browser tools")
    .action(listTools);

  // Get tool details
  browserToolsCommand
    .command("info <toolName>")
    .description("Get detailed information about a specific tool")
    .action(getToolInfo);

  // Execute a tool directly
  browserToolsCommand
    .command("exec <toolName>")
    .description("Execute a browser tool directly")
    .option("-p, --params <json>", "Tool parameters as JSON string")
    .action(executeTool);

  // Search the web
  browserToolsCommand
    .command("search <query>")
    .description("Search the web")
    .option("-l, --limit <number>", "Number of results", "5")
    .action(searchWeb);

  // Take a screenshot
  browserToolsCommand
    .command("screenshot <url>")
    .description("Take a screenshot of a webpage")
    .option("-w, --width <number>", "Viewport width", "1920")
    .option("-h, --height <number>", "Viewport height", "1080")
    .option("-o, --output <path>", "Output file path")
    .action(takeScreenshot);

  // Show tool documentation
  browserToolsCommand
    .command("docs")
    .description("Show browser tools documentation")
    .action(showDocumentation);

  // Clear tool cache
  browserToolsCommand
    .command("clear-cache [toolName]")
    .description("Clear execution cache for browser tools")
    .action(clearCache);

  // Get execution metrics
  browserToolsCommand
    .command("metrics [toolName]")
    .description("Show execution metrics for browser tools")
    .action(showMetrics);
}

/**
 * List all available tools
 */
async function listTools(): Promise<void> {
  try {
    const executor = getExecutor();
    const tools = executor.getAvailableTools();

    console.log("\n📦 Available Browser Tools:\n");

    const byCategory: Record<string, any[]> = {};
    for (const tool of tools) {
      if (!byCategory[tool.category]) {
        byCategory[tool.category] = [];
      }
      byCategory[tool.category].push(tool);
    }

    for (const [category, categoryTools] of Object.entries(byCategory)) {
      console.log(`\n${category.toUpperCase()}`);
      console.log("─".repeat(40));

      for (const tool of categoryTools) {
        console.log(`\n  ${tool.name}`);
        console.log(`  ${tool.description}`);
        console.log(`  Parameters: ${tool.parameters.map((p) => p.name).join(", ") || "none"}`);
      }
    }

    console.log("\n");
  } catch (error) {
    logger.error({ error }, "Failed to list tools");
    console.error("Error listing tools:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Get detailed tool information
 */
async function getToolInfo(toolName: string): Promise<void> {
  try {
    const executor = getExecutor();
    const tool = executor.getTool(toolName);

    console.log(`\n📄 Tool: ${tool.name}`);
    console.log("─".repeat(40));
    console.log(`\nDescription: ${tool.description}`);
    console.log(`Category: ${tool.category}`);
    console.log("\nParameters:");

    for (const param of tool.parameters) {
      const required = param.required ? "[REQUIRED]" : "[optional]";
      console.log(`  • ${param.name} ${required}`);
      console.log(`    Type: ${param.type}`);
      console.log(`    ${param.description}`);
    }

    console.log("\n");
  } catch (error) {
    logger.error({ toolName, error }, "Failed to get tool info");
    console.error(
      `Error getting tool info: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Execute a tool directly
 */
async function executeTool(toolName: string, options: any): Promise<void> {
  try {
    const executor = getExecutor();

    let params: BrowserToolParams = {};
    if (options.params) {
      try {
        params = JSON.parse(options.params);
      } catch (error) {
        throw new Error(`Invalid JSON params: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n🔄 Executing tool: ${toolName}`);
    console.log("Parameters:", JSON.stringify(params, null, 2));
    console.log("");

    const result = await executor.execute({
      toolName,
      params,
      timeout: 30000,
    });

    if (result.success) {
      console.log("✅ Tool execution successful");
      console.log(`Duration: ${result.duration}ms`);
      console.log("\nResult:");
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log("❌ Tool execution failed");
      console.log(`Error: ${result.error}`);
    }

    console.log("\n");
  } catch (error) {
    logger.error({ toolName, error }, "Failed to execute tool");
    console.error(
      `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Search the web
 */
async function searchWeb(query: string, options: any): Promise<void> {
  try {
    const executor = getExecutor();

    console.log(`\n🔍 Searching for: "${query}"`);
    console.log("");

    const result = await executor.execute({
      toolName: "webSearch",
      params: {
        query,
        limit: parseInt(options.limit, 10),
      },
      timeout: 30000,
    });

    if (result.success) {
      console.log("✅ Search completed");
      console.log("\nResults:");
      const data = result.data as any;
      if (data.abstract) {
        console.log(`Abstract: ${data.abstract}`);
        console.log(`Source: ${data.abstractSource}`);
      }
    } else {
      console.log("❌ Search failed");
      console.log(`Error: ${result.error}`);
    }

    console.log("\n");
  } catch (error) {
    logger.error({ query, error }, "Failed to search web");
    console.error(
      `Error searching web: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Take a screenshot
 */
async function takeScreenshot(url: string, options: any): Promise<void> {
  try {
    const executor = getExecutor();

    console.log(`\n📸 Taking screenshot of: ${url}`);
    console.log(`Dimensions: ${options.width}x${options.height}`);
    console.log("");

    const result = await executor.execute({
      toolName: "screenshot",
      params: {
        url,
        width: parseInt(options.width, 10),
        height: parseInt(options.height, 10),
      },
      timeout: 60000,
    });

    if (result.success) {
      console.log("✅ Screenshot taken successfully");
      console.log(`Duration: ${result.duration}ms`);

      if (options.output) {
        const fs = await import("fs");
        const data = result.data as any;
        const buffer = Buffer.from(data.screenshot.split(",")[1], "base64");
        fs.writeFileSync(options.output, buffer);
        console.log(`Saved to: ${options.output}`);
      }
    } else {
      console.log("❌ Screenshot failed");
      console.log(`Error: ${result.error}`);
    }

    console.log("\n");
  } catch (error) {
    logger.error({ url, error }, "Failed to take screenshot");
    console.error(
      `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Show tool documentation
 */
async function showDocumentation(): Promise<void> {
  try {
    const integration = getBrowserToolIntegration();
    const doc = integration.getToolDocumentation();
    console.log("\n" + doc);
  } catch (error) {
    logger.error({ error }, "Failed to show documentation");
    console.error(
      `Error showing documentation: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Clear execution cache
 */
async function clearCache(toolName?: string): Promise<void> {
  try {
    const executor = getExecutor();
    const count = executor.clearCache(toolName);

    if (toolName) {
      console.log(`\n🧹 Cleared cache for tool: ${toolName} (${count} entries removed)\n`);
    } else {
      console.log(`\n🧹 Cleared all cache (${count} entries removed)\n`);
    }
  } catch (error) {
    logger.error({ toolName, error }, "Failed to clear cache");
    console.error(
      `Error clearing cache: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Show execution metrics
 */
async function showMetrics(toolName?: string): Promise<void> {
  try {
    const executor = getExecutor();
    const metrics = executor.getMetrics(toolName);

    console.log("\n📊 Execution Metrics:");
    console.log("─".repeat(60));

    if (Array.isArray(metrics)) {
      for (const metric of metrics) {
        console.log(`\n${metric.toolName}:`);
        console.log(`  Executions: ${metric.executionCount}`);
        console.log(`  Success: ${metric.successCount}`);
        console.log(`  Failures: ${metric.failureCount}`);
        console.log(`  Average Duration: ${metric.averageDuration.toFixed(2)}ms`);
        console.log(`  Min Duration: ${metric.minDuration.toFixed(2)}ms`);
        console.log(`  Max Duration: ${metric.maxDuration.toFixed(2)}ms`);
      }
    } else if (metrics) {
      console.log(`\n${metrics.toolName}:`);
      console.log(`  Executions: ${metrics.executionCount}`);
      console.log(`  Success: ${metrics.successCount}`);
      console.log(`  Failures: ${metrics.failureCount}`);
      console.log(`  Average Duration: ${metrics.averageDuration.toFixed(2)}ms`);
      console.log(`  Min Duration: ${metrics.minDuration.toFixed(2)}ms`);
      console.log(`  Max Duration: ${metrics.maxDuration.toFixed(2)}ms`);
    } else {
      console.log("\nNo metrics available");
    }

    console.log("\n");
  } catch (error) {
    logger.error({ toolName, error }, "Failed to show metrics");
    console.error(
      `Error showing metrics: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
