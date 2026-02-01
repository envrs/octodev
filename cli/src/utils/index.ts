/**
 * Utilities module exports
 */

export { logger, createLogger } from "@/utils/logger";

export {
  CLIError,
  ConfigError,
  ToolError,
  ValidationError,
  handleError,
  handleSigint,
} from "@/utils/error-handler";

export { loadConfig, mergeConfigs } from "@/utils/config-loader";

export {
  ToolExecutionError,
  TimeoutError,
  PermissionError,
  NotFoundError,
  ValidationError as ExecutionValidationError,
  CommandNotWhitelistedError,
  PathTraversalError,
  getErrorSuggestion,
} from "@/utils/custom-errors";

export { ProcessManager, processManager, type ProcessMetadata } from "@/utils/process-manager";
