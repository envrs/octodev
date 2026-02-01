/**
 * Command Validator - Enforces global whitelist for shell commands
 */

export interface CommandValidationOptions {
  whitelist?: string[];
  allowRegex?: RegExp[];
  blockList?: string[];
  caseSensitive?: boolean;
}

export class CommandValidator {
  private whitelist: Set<string>;
  private allowRegex: RegExp[];
  private blockList: Set<string>;
  private caseSensitive: boolean;

  // Default safe commands
  private readonly DEFAULT_WHITELIST = [
    'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'head', 'tail',
    'wc', 'sort', 'uniq', 'cut', 'tr', 'sed', 'awk',
    'mkdir', 'touch', 'rm', 'cp', 'mv', 'chmod',
    'date', 'whoami', 'which', 'whereis', 'file', 'stat',
    'git', 'node', 'npm', 'yarn', 'python', 'ruby',
    'npm', 'pnpm', 'bun'
  ];

  constructor(options: CommandValidationOptions = {}) {
    this.whitelist = new Set(options.whitelist || this.DEFAULT_WHITELIST);
    this.allowRegex = options.allowRegex || [];
    this.blockList = new Set(options.blockList || []);
    this.caseSensitive = options.caseSensitive ?? false;
  }

  /**
   * Validates a command against the whitelist
   */
  validateCommand(command: string): {
    valid: boolean;
    error?: string;
  } {
    if (!command || typeof command !== 'string') {
      return { valid: false, error: 'Command must be a non-empty string' };
    }

    const trimmedCommand = command.trim();
    const baseCommand = this.extractBaseCommand(trimmedCommand);

    // Check block list first
    if (this.isBlocked(baseCommand)) {
      return { valid: false, error: `Command "${baseCommand}" is blocked` };
    }

    // Check whitelist
    if (!this.isWhitelisted(baseCommand)) {
      return {
        valid: false,
        error: `Command "${baseCommand}" is not whitelisted. Allowed commands: ${this.getWhitelistAsString()}`
      };
    }

    // Check for injection attempts
    const injectionCheck = this.checkForInjection(trimmedCommand);
    if (!injectionCheck.valid) {
      return injectionCheck;
    }

    return { valid: true };
  }

  /**
   * Extracts the base command from a full command string
   */
  private extractBaseCommand(command: string): string {
    // Split on whitespace and pipes to get the base command
    const parts = command.split(/[\s|&;>`$()]/)[0].trim();
    return parts.includes('/') ? parts.split('/').pop() || parts : parts;
  }

  /**
   * Checks if command is in whitelist
   */
  private isWhitelisted(command: string): boolean {
    const cmd = this.caseSensitive ? command : command.toLowerCase();

    // Check direct whitelist match
    for (const whitelisted of this.whitelist) {
      const wl = this.caseSensitive ? whitelisted : whitelisted.toLowerCase();
      if (cmd === wl || cmd.endsWith('/' + wl)) {
        return true;
      }
    }

    // Check regex patterns
    for (const regex of this.allowRegex) {
      if (regex.test(command)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if command is blocked
   */
  private isBlocked(command: string): boolean {
    const cmd = this.caseSensitive ? command : command.toLowerCase();
    for (const blocked of this.blockList) {
      const bl = this.caseSensitive ? blocked : blocked.toLowerCase();
      if (cmd === bl || cmd.endsWith('/' + bl)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks for command injection attempts
   */
  private checkForInjection(command: string): { valid: boolean; error?: string } {
    const injectionPatterns = [
      /[;&|`$()]/,  // Shell metacharacters outside quotes
      /\$\{.*\}/,   // Variable expansion
      /`.*`/,       // Command substitution
      /\$\(.*\)/,   // Command substitution
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(command)) {
        // Allow if properly quoted - simple check
        if (!this.isProperlyQuoted(command)) {
          return { valid: false, error: 'Command contains potentially dangerous characters' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Simple check for properly quoted strings
   */
  private isProperlyQuoted(command: string): boolean {
    const singleQuotes = (command.match(/'/g) || []).length;
    const doubleQuotes = (command.match(/"/g) || []).length;
    return singleQuotes % 2 === 0 && doubleQuotes % 2 === 0;
  }

  /**
   * Adds a command to whitelist
   */
  addToWhitelist(command: string): void {
    this.whitelist.add(command);
  }

  /**
   * Removes a command from whitelist
   */
  removeFromWhitelist(command: string): void {
    this.whitelist.delete(command);
  }

  /**
   * Adds a command to block list
   */
  addToBlockList(command: string): void {
    this.blockList.add(command);
  }

  /**
   * Gets whitelist as comma-separated string
   */
  private getWhitelistAsString(): string {
    return Array.from(this.whitelist).slice(0, 10).join(', ') +
           (this.whitelist.size > 10 ? ` +${this.whitelist.size - 10} more` : '');
  }

  /**
   * Gets the full whitelist
   */
  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  /**
   * Gets the full block list
   */
  getBlockList(): string[] {
    return Array.from(this.blockList);
  }
}
