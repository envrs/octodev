/**
 * Environment Manager
 * Handles loading and validation of environment variables
 */

import { createLogger } from "@/utils/logger";
import { ValidationError } from "@/utils/error-handler";
import { z } from "zod";

const logger = createLogger("env-manager");

const EnvSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  AI_PROVIDER: z.string().default("openai"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4-turbo"),
  PROJECT_DIR: z.string().default("./projects"),
  CONFIG_PATH: z.string().optional(),
  DEBUG: z.string().transform((v) => v === "true").default("false"),
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
  NODE_ENV: z.enum(["development", "production"]).optional(),
});

export type Environment = z.infer<typeof EnvSchema>;

export class EnvironmentManager {
  private env: Environment;

  constructor() {
    this.env = this.loadAndValidate();
    logger.debug({ env: this.sanitize() }, "Environment loaded");
  }

  /**
   * Load and validate environment variables
   */
  private loadAndValidate(): Environment {
    try {
      const rawEnv = {
        LOG_LEVEL: process.env.LOG_LEVEL,
        LOG_FORMAT: process.env.LOG_FORMAT,
        AI_PROVIDER: process.env.AI_PROVIDER,
        AI_API_KEY: process.env.AI_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
        PROJECT_DIR: process.env.PROJECT_DIR,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DEBUG: process.env.DEBUG,
        ENVIRONMENT: process.env.ENVIRONMENT,
        NODE_ENV: process.env.NODE_ENV,
      };

      return EnvSchema.parse(rawEnv);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        throw new ValidationError(`Invalid environment variables: ${messages.join(", ")}`);
      }
      throw new ValidationError(`Failed to load environment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get environment variable
   */
  get<K extends keyof Environment>(key: K): Environment[K] {
    return this.env[key];
  }

  /**
   * Get all environment variables (sanitized)
   */
  getAll(): Environment {
    return { ...this.env };
  }

  /**
   * Check if in development mode
   */
  isDevelopment(): boolean {
    return this.env.ENVIRONMENT === "development";
  }

  /**
   * Check if in production mode
   */
  isProduction(): boolean {
    return this.env.ENVIRONMENT === "production";
  }

  /**
   * Check if debug mode is enabled
   */
  isDebug(): boolean {
    return this.env.DEBUG;
  }

  /**
   * Get AI provider configuration
   */
  getAIConfig() {
    return {
      provider: this.env.AI_PROVIDER,
      apiKey: this.env.AI_API_KEY,
      model: this.env.AI_MODEL,
    };
  }

  /**
   * Verify required variables are set
   */
  verifyRequired(keys: (keyof Environment)[]): boolean {
    for (const key of keys) {
      if (!this.env[key]) {
        logger.warn({ key }, "Required environment variable not set");
        return false;
      }
    }
    return true;
  }

  /**
   * Sanitize for logging (remove sensitive data)
   */
  private sanitize(): Partial<Environment> {
    const { AI_API_KEY, ...safe } = this.env;
    return {
      ...safe,
      AI_API_KEY: AI_API_KEY ? `***${AI_API_KEY.slice(-4)}` : undefined,
    };
  }
}

/**
 * Global environment manager instance
 */
let globalEnv: EnvironmentManager | null = null;

export function getEnvironment(): EnvironmentManager {
  if (!globalEnv) {
    globalEnv = new EnvironmentManager();
  }
  return globalEnv;
}

export function resetEnvironment() {
  globalEnv = null;
}
