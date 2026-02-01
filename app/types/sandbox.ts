/**
 * Sandbox execution types and configurations
 */

export type ExecutionType = 'ai-agent' | 'user-upload' | 'third-party' | 'playground';
export type ExecutionLanguage = 'javascript' | 'typescript' | 'node';
export type ValidationLevel = 'strict' | 'moderate' | 'permissive';

/**
 * Execution constraints - matches configured limits
 */
export const SANDBOX_LIMITS = {
  TIMEOUT_MS: 15000, // 15 seconds
  MEMORY_MB: 512,
  FILESYSTEM_MB: 200,
  MAX_CONCURRENT_EXECUTIONS: 10,
  MAX_FILE_SIZE_MB: 10,
} as const;

/**
 * Dangerous operations that trigger validation warnings
 */
export const DANGEROUS_OPERATIONS = {
  FILE_DELETE: ['rmSync', 'unlinkSync', 'rm', 'unlink'],
  PROCESS_EXEC: ['exec', 'execSync', 'spawn', 'spawnSync', 'fork'],
  FILE_WRITE: ['writeFileSync', 'writeFile', 'appendFileSync'],
  NETWORK: ['http.request', 'https.request', 'fetch', 'XMLHttpRequest'],
  EVAL: ['eval', 'Function', 'setTimeout', 'setInterval'],
  REQUIRE_DYNAMIC: ['require.main', 'require.resolve'],
} as const;

export interface SandboxConfig {
  id: string;
  executionType: ExecutionType;
  language: ExecutionLanguage;
  validationLevel: ValidationLevel;
  timeout: number;
  memoryLimit: number;
  filesystemLimit: number;
  allowNetworkRequests: boolean;
  whitelistedDomains?: string[];
  environmentVariables?: Record<string, string>;
  workspaceId?: string;
}

export interface ExecutionLog {
  id: string;
  sandboxId: string;
  executionType: ExecutionType;
  language: ExecutionLanguage;
  code: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout' | 'aborted';
  exitCode?: number;
  output: string;
  errors: string;
  warnings: string[];
  fileOperations: FileOperation[];
  networkRequests: NetworkRequest[];
  validationResult?: ValidationResult;
}

export interface FileOperation {
  timestamp: number;
  operation: 'read' | 'write' | 'delete' | 'mkdir';
  path: string;
  size?: number;
  error?: string;
}

export interface NetworkRequest {
  timestamp: number;
  method: string;
  url: string;
  headers?: Record<string, string>;
  status?: number;
  blocked: boolean;
  reason?: string;
}

export interface ValidationResult {
  level: ValidationLevel;
  isValid: boolean;
  issues: ValidationIssue[];
  dangerousOperations: DangerousOperation[];
  severity: 'safe' | 'warning' | 'critical';
}

export interface ValidationIssue {
  type: 'dangerous-operation' | 'resource-limit' | 'network-request' | 'syntax-error';
  severity: 'info' | 'warning' | 'error';
  message: string;
  location?: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface DangerousOperation {
  operation: string;
  category: keyof typeof DANGEROUS_OPERATIONS;
  location?: {
    line: number;
    column: number;
  };
  description: string;
}

export interface ExecutionSnapshot {
  beforeState: {
    files: Record<string, string>;
    timestamp: number;
  };
  afterState: {
    files: Record<string, string>;
    timestamp: number;
  };
  changes: FileChange[];
}

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  before?: string;
  after?: string;
  size: number;
}

export interface SandboxSession {
  id: string;
  sandboxId: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  status: 'initialized' | 'running' | 'completed' | 'failed' | 'terminated';
  executionLogs: ExecutionLog[];
  snapshot?: ExecutionSnapshot;
  approvalRequired: boolean;
  approvedBy?: string;
  approvalTime?: number;
}
