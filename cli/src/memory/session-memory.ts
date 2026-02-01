import { HistoryDB, getHistoryDB, CommandRecord } from "@/memory/history-db";
import { ToolExecutionResult } from "@/types";
import { v4 as uuidv4 } from "crypto";
import { createLogger } from "@/utils/logger";

const logger = createLogger("session-memory");

/**
 * Session memory for tracking execution history and learning patterns
 */
export class SessionMemory {
  private sessionId: string;
  private db: HistoryDB;
  private startTime: Date;
  private commandCount: number = 0;
  private successCount: number = 0;

  constructor(dbPath?: string) {
    this.sessionId = this.generateSessionId();
    this.db = getHistoryDB(dbPath);
    this.startTime = new Date();

    // Start session in database
    this.db.startSession(this.sessionId);
    logger.debug({ sessionId: this.sessionId }, "Session memory initialized");
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Record a command execution
   */
  recordExecution(
    userInput: string,
    tool: string,
    result: ToolExecutionResult,
    duration: number
  ): void {
    const success = result.success;

    this.db.recordCommand(
      this.sessionId,
      userInput,
      tool,
      success,
      duration,
      result.output ? result.output.substring(0, 1000) : undefined // Truncate large outputs
    );

    this.commandCount++;
    if (success) {
      this.successCount++;
    }

    const successRate = (this.successCount / this.commandCount) * 100;
    logger.debug(
      { tool, success, successRate: successRate.toFixed(1) },
      "Command recorded"
    );
  }

  /**
   * Get recent commands from this session
   */
  getRecentCommands(limit: number = 20): CommandRecord[] {
    return this.db.getSessionHistory(this.sessionId, limit);
  }

  /**
   * Get commands for a specific tool
   */
  getToolCommands(tool: string, limit: number = 50): CommandRecord[] {
    return this.db.getToolHistory(tool, limit);
  }

  /**
   * Get successful command patterns (for learning)
   */
  getSuccessfulPatterns(tool?: string, limit: number = 10): CommandRecord[] {
    let records: CommandRecord[] = [];

    if (tool) {
      records = this.getToolCommands(tool, 100);
    } else {
      records = this.getRecentCommands(100);
    }

    return records
      .filter((r) => r.success)
      .slice(0, limit);
  }

  /**
   * Get failed commands for troubleshooting
   */
  getFailedCommands(limit: number = 10): CommandRecord[] {
    const commands = this.getRecentCommands(50);
    return commands.filter((r) => !r.success).slice(0, limit);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    sessionId: string;
    commandCount: number;
    successCount: number;
    successRate: number;
    duration: number;
    avgCommandTime: number;
  } {
    const now = Date.now();
    const duration = now - this.startTime.getTime();

    const recent = this.getRecentCommands(100);
    const avgDuration = recent.length > 0
      ? recent.reduce((sum, r) => sum + (r.duration || 0), 0) / recent.length
      : 0;

    return {
      sessionId: this.sessionId,
      commandCount: this.commandCount,
      successCount: this.successCount,
      successRate: this.commandCount > 0 ? (this.successCount / this.commandCount) * 100 : 0,
      duration,
      avgCommandTime: avgDuration,
    };
  }

  /**
   * Get learning insights from history
   */
  getLearningInsights(): {
    mostUsedTool: string | null;
    highestFailureRate: string | null;
    recommendedNextTools: string[];
  } {
    const recent = this.getRecentCommands(50);

    // Most used tool
    const toolCount = new Map<string, number>();
    recent.forEach((r) => {
      toolCount.set(r.tool, (toolCount.get(r.tool) || 0) + 1);
    });
    const mostUsedTool = Array.from(toolCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Tool with highest failure rate
    const toolSuccess = new Map<string, { total: number; success: number }>();
    recent.forEach((r) => {
      const current = toolSuccess.get(r.tool) || { total: 0, success: 0 };
      current.total++;
      if (r.success) current.success++;
      toolSuccess.set(r.tool, current);
    });

    let highestFailureRate: string | null = null;
    let maxFailureRate = 0;
    toolSuccess.forEach((stats, tool) => {
      const failureRate = 1 - stats.success / stats.total;
      if (failureRate > maxFailureRate && stats.total >= 3) {
        maxFailureRate = failureRate;
        highestFailureRate = tool;
      }
    });

    // Recommended next tools based on patterns
    const toolSequences = new Map<string, Map<string, number>>();
    for (let i = 0; i < recent.length - 1; i++) {
      const current = recent[i].tool;
      const next = recent[i + 1].tool;
      if (!toolSequences.has(current)) {
        toolSequences.set(current, new Map());
      }
      const nextMap = toolSequences.get(current)!;
      nextMap.set(next, (nextMap.get(next) || 0) + 1);
    }

    const lastTool = recent[0]?.tool;
    const recommendedNextTools: string[] = [];
    if (lastTool && toolSequences.has(lastTool)) {
      const nextTools = toolSequences.get(lastTool)!;
      recommendedNextTools = Array.from(nextTools.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tool]) => tool);
    }

    return {
      mostUsedTool,
      highestFailureRate,
      recommendedNextTools,
    };
  }

  /**
   * Save command as macro
   */
  saveMacro(name: string, commands: string, description?: string): void {
    this.db.saveMacro(name, commands, description);
    logger.debug({ name }, "Macro saved to memory");
  }

  /**
   * Get saved macros
   */
  getMacros() {
    return this.db.getMacros();
  }

  /**
   * Record command with AI metadata
   */
  recordCommand(options: {
    input: string;
    command: string;
    toolName: string;
    success: boolean;
    output: string;
    errorMessage?: string;
    aiGenerated?: boolean;
    confidence?: number;
  }): void {
    this.db.recordCommand(
      this.sessionId,
      options.input,
      options.toolName,
      options.success,
      0,
      options.output
    );

    this.commandCount++;
    if (options.success) {
      this.successCount++;
    }

    logger.debug(
      {
        tool: options.toolName,
        success: options.success,
        aiGenerated: options.aiGenerated,
        confidence: options.confidence,
      },
      "Command recorded"
    );
  }

  /**
   * Record success for learning
   */
  recordSuccess(command: string, confidence: number): void {
    logger.debug({ command, confidence }, "Success recorded for learning");
    // Could be used to boost confidence for similar patterns
  }

  /**
   * Record failure for learning
   */
  recordFailure(command: string, error: string): void {
    logger.debug({ command, error }, "Failure recorded for learning");
    // Could be used to adjust confidence for similar patterns
  }

  /**
   * Record macro
   */
  recordMacro(macro: { id: string; name: string; commands: string[]; description?: string }): Promise<void> {
    return Promise.resolve(this.db.saveMacro(macro.name, macro.commands.join(";"), macro.description));
  }

  /**
   * Get macros
   */
  async getMacros(): Promise<any[]> {
    return this.db.getMacros();
  }

  /**
   * Delete macro
   */
  async deleteMacro(id: string): Promise<void> {
    // This would require database support for deletion by ID
    logger.debug({ id }, "Macro deletion requested");
  }

  /**
   * Get session metrics for cost tracking
   */
  getSessionMetrics() {
    return {
      totalTokens: 0, // Would be set by AI engine
      totalCost: 0,   // Would be calculated by AI engine
      successRate: this.commandCount > 0 ? (this.successCount / this.commandCount) * 100 : 0,
    };
  }

  /**
   * End session and cleanup
   */
  endSession(): void {
    this.db.endSession(this.sessionId);
    logger.debug({ sessionId: this.sessionId }, "Session ended");
  }

  /**
   * Export session data
   */
  exportSession(): Record<string, any> {
    return this.db.exportHistory(this.sessionId);
  }
}

/**
 * Singleton instance
 */
let sessionMemoryInstance: SessionMemory | null = null;

export function getSessionMemory(dbPath?: string): SessionMemory {
  if (!sessionMemoryInstance) {
    sessionMemoryInstance = new SessionMemory(dbPath);
  }
  return sessionMemoryInstance;
}

export function resetSessionMemory(): void {
  if (sessionMemoryInstance) {
    sessionMemoryInstance.endSession();
  }
  sessionMemoryInstance = null;
}
