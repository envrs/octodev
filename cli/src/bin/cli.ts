#!/usr/bin/env node

/**
 * octodev-cli - Main entry point
 */

import "dotenv/config";
import { Program } from "commander";
import { createLogger } from "@/utils/logger";
import { handleError, handleSigint, CLIError } from "@/utils/error-handler";
import { registerVersionCommand, handleVersionCommand } from "@/commands/version";
import { registerShellCommand, handleShellCommand } from "@/commands/shell";
import { buildHelpText } from "@/commands/help";

const logger = createLogger("cli");
const packageVersion = "0.1.0";

async function main() {
  try {
    logger.debug("CLI starting");

    const program = new Program();

    program
      .name("octodev")
      .description("AI-powered development tool CLI")
      .version(packageVersion)
      .option("--debug", "enable debug logging", false)
      .option("--config <path>", "path to config file")
      .option("--profile <name>", "profile to use");

    // Register commands
    registerVersionCommand(program);
    registerShellCommand(program);

    // Custom help
    program.addHelpCommand("help [command]", "show help");

    // Parse arguments
    await program.parseAsync(process.argv);

    // If no arguments provided, show help and start shell
    if (process.argv.length === 2) {
      console.log(buildHelpText());
      process.exit(0);
    }
  } catch (error) {
    handleError(error);
  }
}

// Handle signals
process.on("SIGINT", handleSigint);
process.on("SIGTERM", () => {
  logger.info("Process terminated");
  process.exit(0);
});

// Run CLI
main().catch(handleError);
