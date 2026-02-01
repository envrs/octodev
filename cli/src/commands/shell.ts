/**
 * Interactive shell command
 */

import { createLogger } from "@/utils/logger";
import { loadConfig } from "@/utils/config-loader";
import { createTUIShell } from "@/tui/shell";

const logger = createLogger("shell-command");

export function registerShellCommand(program: any) {
  program
    .command("shell")
    .description("Launch interactive TUI shell")
    .option("--config <path>", "path to config file")
    .option("--profile <name>", "profile to use")
    .action(handleShellCommand);

  return program;
}

export async function handleShellCommand(options: any) {
  logger.info("Starting interactive shell");

  try {
    const config = await loadConfig(options.config);
    const shell = await createTUIShell(config);

    logger.debug("TUI shell initialized");
    await shell.start();
  } catch (error) {
    logger.error({ error }, "Failed to start shell");
    throw error;
  }
}
