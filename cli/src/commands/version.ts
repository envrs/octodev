/**
 * Version command
 */

import { createLogger } from "@/utils/logger";

const logger = createLogger("version-command");
const version = "0.1.0";

export function registerVersionCommand(program: any) {
  program
    .version(version, "-v, --version", "display version number")
    .option("--json", "output as JSON");

  return program;
}

export async function handleVersionCommand(options: any) {
  logger.debug({ version }, "Version requested");

  if (options.json) {
    console.log(JSON.stringify({ version }, null, 2));
  } else {
    console.log(`octodev-cli version ${version}`);
  }
}
