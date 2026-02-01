import type { Message } from 'ai';

export interface ExecutionOptions {
  agent: string; // Provider name (e.g., 'Anthropic', 'OpenAI')
  model: string; // Model ID (e.g., 'claude-3-5-sonnet-20241022')
  prompt?: string; // For simple text prompts
  messages?: Message[]; // For conversation-based prompts
  system?: string; // System prompt
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
  timeout?: number; // milliseconds
  retryCount?: number;
}

export interface ExecutionResult {
  success: boolean;
  data?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  cacheHit?: boolean;
  duration: number;
  executionId: string;
}

export interface AgentMetrics {
  agent: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheHits: number;
}

export interface AgentConfig {
  name: string;
  models: Array<{
    name: string;
    label: string;
    maxTokens?: number;
  }>;
  icon?: string;
  apiKeyLink?: string;
}

export interface FallbackConfig {
  primary: {
    agent: string;
    model: string;
  };
  secondary?: {
    agent: string;
    model: string;
  };
  tertiary?: {
    agent: string;
    model: string;
  };
}

export interface ExecutionApproval {
  executionId: string;
  agent: string;
  model: string;
  prompt: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  requiresApproval: boolean;
  approved?: boolean;
  approvedAt?: number;
}
