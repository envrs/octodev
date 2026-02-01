/**
 * Core type definitions for octodev-cli
 */

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  parameters: ToolParameter[];
  permissions: string[];
  examples?: string[];
}

export interface ToolExecutionContext {
  userId?: string;
  projectId?: string;
  sessionId: string;
  environment: "development" | "production";
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
}

export interface TUIMessage {
  id: string;
  type: "user" | "assistant" | "system" | "error";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CLIConfig {
  version: string;
  profile: string;
  projectDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  aiProvider: string;
  tools: string[];
  toolRegistry?: {
    paths?: string[];
  };
}

export interface CLIState {
  isInitialized: boolean;
  currentProfile: string;
  messages: TUIMessage[];
  activeTool?: string;
  isConnected: boolean;
  sessionId: string;
}
