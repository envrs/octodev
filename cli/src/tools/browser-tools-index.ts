/**
 * Browser Tools Module - Main Exports
 */

export {
  type BrowserToolParams,
  type BrowserToolResult,
  type BrowserTool,
  BROWSER_TOOLS,
  getBrowserTool,
  getAllBrowserTools,
  getBrowserToolsByCategory,
  webSearchTool,
  screenshotTool,
  domInspectTool,
  webScrapeTool,
} from "./browser-tools";

export {
  BrowserBridge,
  getBrowserBridge,
  resetBrowserBridge,
  type BrowserBridgeConfig,
} from "./browser-bridge";

export {
  ToolExecutor,
  executeTool,
  getExecutor,
  getAvailableTools,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolExecutionMetrics,
} from "./tool-executor";
