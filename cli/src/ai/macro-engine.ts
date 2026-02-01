/**
 * Macro Engine
 * Detects repeated command sequences and manages macro creation/execution
 */

import { SessionMemory } from "@/memory/session-memory";
import { createLogger } from "@/utils/logger";

const logger = createLogger("macro-engine");

/**
 * Macro definition
 */
export interface Macro {
  id: string;
  name: string;
  commands: string[];
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  description?: string;
}

/**
 * Sequence detection result
 */
export interface DetectedSequence {
  commands: string[];
  count: number;
  lastOccurrence: number;
  isRepeating: boolean;
}

/**
 * Macro Engine Configuration
 */
export interface MacroEngineConfig {
  detectionThreshold: number; // How many identical sequences before suggesting
  maxMacros: number;
  persistMacros: boolean;
}

/**
 * Macro Engine
 * Detects repeated command patterns and provides macro management
 */
export class MacroEngine {
  private memory: SessionMemory;
  private config: MacroEngineConfig;
  private commandHistory: string[] = [];
  private detectedSequences: Map<string, DetectedSequence> = new Map();

  constructor(memory: SessionMemory, config: Partial<MacroEngineConfig> = {}) {
    this.memory = memory;
    this.config = {
      detectionThreshold: 3,
      maxMacros: 50,
      persistMacros: true,
      ...config,
    };
  }

  /**
   * Record a command for pattern detection
   */
  recordCommand(command: string): void {
    this.commandHistory.push(command);
    this.detectSequences();
  }

  /**
   * Detect repeated command sequences
   */
  private detectSequences(): void {
    if (this.commandHistory.length < this.config.detectionThreshold) {
      return;
    }

    // Check for repeated command patterns
    const recentCommands = this.commandHistory.slice(-20); // Look at last 20 commands

    // Check for immediately repeated commands
    for (let i = recentCommands.length - 1; i >= this.config.detectionThreshold - 1; i--) {
      const potential = recentCommands[i];

      // Count occurrences
      let count = 0;
      for (let j = i; j >= 0; j--) {
        if (recentCommands[j] === potential) {
          count++;
        } else if (count >= this.config.detectionThreshold) {
          break;
        } else {
          count = 0;
        }
      }

      if (count >= this.config.detectionThreshold) {
        const sequenceKey = `cmd:${potential}`;
        const existing = this.detectedSequences.get(sequenceKey);

        this.detectedSequences.set(sequenceKey, {
          commands: [potential],
          count,
          lastOccurrence: i,
          isRepeating: true,
        });

        logger.debug(
          { command: potential, count },
          "Detected repeated command sequence"
        );
      }
    }
  }

  /**
   * Get detected sequences that should be suggested as macros
   */
  getDetectedSequences(): DetectedSequence[] {
    const threshold = this.config.detectionThreshold;
    return Array.from(this.detectedSequences.values()).filter(
      (seq) => seq.count >= threshold && seq.isRepeating
    );
  }

  /**
   * Create a new macro from detected sequence
   */
  async createMacro(
    name: string,
    commands: string[],
    description?: string
  ): Promise<Macro> {
    const macro: Macro = {
      id: `macro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      commands,
      createdAt: new Date(),
      usageCount: 0,
      description,
    };

    // Save to memory if persistence enabled
    if (this.config.persistMacros) {
      await this.memory.recordMacro(macro);
      logger.info({ name, commandCount: commands.length }, "Macro created and saved");
    }

    // Clear the detected sequence
    this.detectedSequences.delete(`cmd:${commands.join("|")}`);

    return macro;
  }

  /**
   * Get all available macros
   */
  async getMacros(): Promise<Macro[]> {
    if (this.config.persistMacros) {
      return await this.memory.getMacros();
    }
    return [];
  }

  /**
   * Execute a macro by name
   */
  async executeMacro(name: string): Promise<string[]> {
    const macros = await this.getMacros();
    const macro = macros.find((m) => m.name === name);

    if (!macro) {
      throw new Error(`Macro "${name}" not found`);
    }

    // Update usage stats
    macro.usageCount++;
    macro.lastUsed = new Date();
    if (this.config.persistMacros) {
      await this.memory.recordMacro(macro);
    }

    logger.info({ name, commands: macro.commands.length }, "Executing macro");

    return macro.commands;
  }

  /**
   * Delete a macro
   */
  async deleteMacro(name: string): Promise<boolean> {
    const macros = await this.getMacros();
    const macroToDelete = macros.find((m) => m.name === name);

    if (!macroToDelete) {
      return false;
    }

    if (this.config.persistMacros) {
      await this.memory.deleteMacro(macroToDelete.id);
    }

    logger.info({ name }, "Macro deleted");
    return true;
  }

  /**
   * Get macro statistics
   */
  async getMacroStats() {
    const macros = await this.getMacros();
    return {
      totalMacros: macros.length,
      detectedSequences: this.detectedSequences.size,
      mostUsed: macros.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
    };
  }

  /**
   * Clear history and detection
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.detectedSequences.clear();
    logger.debug("Macro engine history cleared");
  }
}

/**
 * Factory function to create macro engine
 */
export function createMacroEngine(
  memory: SessionMemory,
  config?: Partial<MacroEngineConfig>
): MacroEngine {
  return new MacroEngine(memory, config);
}
