/**
 * Centralized error handler for CLI
 */

import { createLogger } from "./logger";

const logger = createLogger("error-handler");

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string = "CLI_ERROR",
    public statusCode: number = 1
  ) {
    super(message);
    this.name = "CLIError";
    Object.setPrototypeOf(this, CLIError.prototype);
  }
}

export class ConfigError extends CLIError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", 1);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class ToolError extends CLIError {
  constructor(message: string) {
    super(message, "TOOL_ERROR", 1);
    this.name = "ToolError";
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 1);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    logger.error(
      {
        code: error.code,
        message: error.message,
      },
      "CLI Error"
    );
    console.error(`\n[${error.code}] ${error.message}\n`);
    process.exit(error.statusCode);
  }

  if (error instanceof Error) {
    logger.error(
      {
        message: error.message,
        stack: error.stack,
      },
      "Unexpected Error"
    );
    console.error(`\n[ERROR] ${error.message}\n`);
    process.exit(1);
  }

  logger.error({ error }, "Unknown Error");
  console.error("\n[ERROR] An unknown error occurred\n");
  process.exit(1);
}

export function handleSigint(): never {
  logger.info("CLI interrupted by user");
  console.log("\n\nGoodbye!");
  process.exit(0);
}
