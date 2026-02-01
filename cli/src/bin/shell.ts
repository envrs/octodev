#!/usr/bin/env node

/**
 * Direct shell entry point for interactive TUI
 */

import "dotenv/config";
import { handleShellCommand } from "@/commands/shell";
import { handleError, handleSigint } from "@/utils/error-handler";

process.on("SIGINT", handleSigint);

handleShellCommand({})
  .catch(handleError);
