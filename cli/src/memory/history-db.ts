import Database from "better-sqlite3";
import path from "path";
import { createLogger } from "@/utils/logger";

const logger = createLogger("history-db");

/**
 * SQLite database schema for CLI history and memory
 */
export interface CommandRecord {
  id: number;
  sessionId: string;
  timestamp: number;
  userInput: string;
  tool: string;
  success: boolean;
  duration: number;
  output?: string;
}

export interface SessionRecord {
  id: number;
  sessionId: string;
  startTime: number;
  endTime?: number;
  commandCount: number;
  successCount: number;
}

export interface MacroRecord {
  id: number;
  name: string;
  commands: string;
  created: number;
  executed: number;
}

/**
 * Manages SQLite database for history persistence
 */
export class HistoryDB {
  private db: Database.Database;
  private initialized: boolean = false;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), ".octodev", "history.db");
    this.db = new Database(dbPath || defaultPath);

    // Enable foreign keys and WAL mode for better concurrency
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Initialize database schema
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Create sessions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT UNIQUE NOT NULL,
          startTime INTEGER NOT NULL,
          endTime INTEGER,
          commandCount INTEGER DEFAULT 0,
          successCount INTEGER DEFAULT 0
        );
      `);

      // Create commands table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS commands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          userInput TEXT NOT NULL,
          tool TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          duration INTEGER,
          output TEXT,
          FOREIGN KEY (sessionId) REFERENCES sessions(sessionId)
        );
      `);

      // Create macros table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS macros (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          commands TEXT NOT NULL,
          created INTEGER NOT NULL,
          executed INTEGER DEFAULT 0,
          description TEXT
        );
      `);

      // Create indexes for faster queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_commands_session ON commands(sessionId);
        CREATE INDEX IF NOT EXISTS idx_commands_timestamp ON commands(timestamp);
        CREATE INDEX IF NOT EXISTS idx_commands_tool ON commands(tool);
        CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(startTime);
      `);

      this.initialized = true;
      logger.debug("Database initialized");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to initialize database");
      throw error;
    }
  }

  /**
   * Start a new session
   */
  startSession(sessionId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (sessionId, startTime)
      VALUES (?, ?)
    `);

    stmt.run(sessionId, Date.now());
    logger.debug({ sessionId }, "Session started");
  }

  /**
   * End current session
   */
  endSession(sessionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET endTime = ?
      WHERE sessionId = ?
    `);

    stmt.run(Date.now(), sessionId);
    logger.debug({ sessionId }, "Session ended");
  }

  /**
   * Record a command execution
   */
  recordCommand(
    sessionId: string,
    userInput: string,
    tool: string,
    success: boolean,
    duration: number,
    output?: string
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO commands (sessionId, timestamp, userInput, tool, success, duration, output)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      sessionId,
      Date.now(),
      userInput,
      tool,
      success ? 1 : 0,
      duration,
      output || null
    );

    // Update session stats
    this.updateSessionStats(sessionId, success);

    return result.lastInsertRowid as number;
  }

  /**
   * Update session command/success counts
   */
  private updateSessionStats(sessionId: string, success: boolean): void {
    const updateStmt = this.db.prepare(`
      UPDATE sessions
      SET commandCount = commandCount + 1,
          successCount = successCount + ?
      WHERE sessionId = ?
    `);

    updateStmt.run(success ? 1 : 0, sessionId);
  }

  /**
   * Get session history
   */
  getSessionHistory(sessionId: string, limit: number = 50): CommandRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM commands
      WHERE sessionId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(sessionId, limit) as CommandRecord[];
  }

  /**
   * Get all commands for a tool
   */
  getToolHistory(tool: string, limit: number = 100): CommandRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM commands
      WHERE tool = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(tool, limit) as CommandRecord[];
  }

  /**
   * Get command statistics
   */
  getStats(): {
    totalCommands: number;
    successRate: number;
    totalSessions: number;
    avgCommandsPerSession: number;
  } {
    const commandStmt = this.db.prepare(
      "SELECT COUNT(*) as count, SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful FROM commands"
    );
    const commandResult = commandStmt.get() as any;

    const sessionStmt = this.db.prepare("SELECT COUNT(*) as count FROM sessions");
    const sessionResult = sessionStmt.get() as any;

    const totalCommands = commandResult?.count || 0;
    const successfulCommands = commandResult?.successful || 0;
    const totalSessions = sessionResult?.count || 0;

    return {
      totalCommands,
      successRate: totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0,
      totalSessions,
      avgCommandsPerSession: totalSessions > 0 ? totalCommands / totalSessions : 0,
    };
  }

  /**
   * Save a command macro
   */
  saveMacro(name: string, commands: string, description?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO macros (name, commands, created, description)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(name, commands, Date.now(), description || null);
    logger.debug({ name }, "Macro saved");
  }

  /**
   * Get all macros
   */
  getMacros(): MacroRecord[] {
    const stmt = this.db.prepare("SELECT * FROM macros ORDER BY created DESC");
    return stmt.all() as MacroRecord[];
  }

  /**
   * Execute a macro (increment counter)
   */
  executeMacro(name: string): void {
    const stmt = this.db.prepare(`
      UPDATE macros
      SET executed = executed + 1
      WHERE name = ?
    `);

    stmt.run(name);
  }

  /**
   * Clean up old records (older than N days)
   */
  cleanup(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      DELETE FROM commands
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffTime);

    logger.debug(
      { deleted: result.changes, daysToKeep },
      "Database cleanup completed"
    );

    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.debug("Database closed");
  }

  /**
   * Export history as JSON
   */
  exportHistory(sessionId?: string): Record<string, any> {
    const commands = sessionId
      ? this.getSessionHistory(sessionId, 1000)
      : this.db.prepare("SELECT * FROM commands").all() as CommandRecord[];

    const sessions = this.db.prepare("SELECT * FROM sessions").all() as SessionRecord[];
    const macros = this.getMacros();

    return {
      exportedAt: new Date().toISOString(),
      commands,
      sessions: sessionId ? sessions.filter((s) => s.sessionId === sessionId) : sessions,
      macros,
      stats: this.getStats(),
    };
  }
}

/**
 * Singleton instance
 */
let dbInstance: HistoryDB | null = null;

export function getHistoryDB(dbPath?: string): HistoryDB {
  if (!dbInstance) {
    dbInstance = new HistoryDB(dbPath);
    dbInstance.initialize();
  }
  return dbInstance;
}
