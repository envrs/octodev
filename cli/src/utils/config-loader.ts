/**
 * Configuration loader for .octodevrc and environment variables
 */

import { promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";
import { createLogger } from "./logger";
import { ConfigError } from "./error-handler";
import { CLIConfig } from "@/types";

const logger = createLogger("config-loader");

const ConfigSchema = z.object({
  version: z.string(),
  profile: z.string().default("default"),
  projectDir: z.string().default("./projects"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  aiProvider: z.string().default("openai"),
  tools: z.array(z.string()).default([]),
  toolRegistry: z
    .object({
      paths: z.array(z.string()).optional(),
    })
    .optional(),
});

type RawConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(configPath?: string): Promise<CLIConfig> {
  try {
    const searchPaths = [
      configPath,
      process.env.CONFIG_PATH,
      path.join(process.cwd(), ".octodevrc"),
      path.join(process.cwd(), ".octodevrc.yaml"),
      path.join(process.cwd(), ".octodevrc.yml"),
      path.join(process.cwd(), ".octodevrc.json"),
    ].filter(Boolean);

    let config: RawConfig | null = null;

    for (const filePath of searchPaths) {
      if (!filePath) continue;
      try {
        const exists = await fs.stat(filePath).catch(() => null);
        if (!exists) continue;

        const content = await fs.readFile(filePath, "utf-8");
        const parsed = yaml.load(content);

        if (parsed && typeof parsed === "object") {
          config = parsed as RawConfig;
          logger.info({ configPath: filePath }, "Config loaded");
          break;
        }
      } catch (e) {
        logger.debug({ path: filePath, error: e }, "Config file not found or invalid");
        continue;
      }
    }

    if (!config) {
      logger.info("No config file found, using defaults");
      config = {
        version: "0.1.0",
        profile: "default",
        projectDir: process.env.PROJECT_DIR || "./projects",
        logLevel: (process.env.LOG_LEVEL as any) || "info",
        aiProvider: process.env.AI_PROVIDER || "openai",
        tools: [],
      };
    }

    // Override with environment variables
    if (process.env.LOG_LEVEL) config.logLevel = process.env.LOG_LEVEL as any;
    if (process.env.PROJECT_DIR) config.projectDir = process.env.PROJECT_DIR;
    if (process.env.AI_PROVIDER) config.aiProvider = process.env.AI_PROVIDER;

    const validated = ConfigSchema.parse(config);
    logger.debug({ config: validated }, "Config validated");

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigError(`Invalid configuration: ${error.errors.map((e) => e.message).join(", ")}`);
    }
    throw new ConfigError(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function mergeConfigs(base: CLIConfig, overrides: Partial<CLIConfig>): CLIConfig {
  return {
    ...base,
    ...overrides,
  };
}
