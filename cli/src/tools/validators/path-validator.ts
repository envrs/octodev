import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const realpath = promisify(fs.realpath);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

export interface PathValidationOptions {
  allowedDirectories?: string[];
  allowSymlinks?: boolean;
  maxDepth?: number;
}

export class PathValidator {
  private allowedDirectories: Set<string>;
  private allowSymlinks: boolean;
  private maxDepth: number;

  constructor(options: PathValidationOptions = {}) {
    this.allowedDirectories = new Set(options.allowedDirectories || [process.cwd()]);
    this.allowSymlinks = options.allowSymlinks ?? false;
    this.maxDepth = options.maxDepth ?? 10;
  }

  /**
   * Validates that a path is within allowed directories
   */
  async validatePath(targetPath: string, operation: 'read' | 'write' | 'execute'): Promise<{
    valid: boolean;
    error?: string;
    resolvedPath?: string;
  }> {
    try {
      // Resolve to absolute path
      const resolvedPath = path.resolve(targetPath);
      const realPath = await realpath(resolvedPath);

      // Check for path traversal attempts
      if (this.containsEscapeSequences(targetPath)) {
        return { valid: false, error: 'Path contains escape sequences' };
      }

      // Check symlink policy
      if (!this.allowSymlinks) {
        const stats = await stat(realPath);
        if (stats.isSymbolicLink?.()) {
          return { valid: false, error: 'Symbolic links are not allowed' };
        }
      }

      // Check if path is within allowed directories
      const isAllowed = Array.from(this.allowedDirectories).some(allowedDir => {
        const allowedReal = path.resolve(allowedDir);
        return realPath.startsWith(allowedReal + path.sep) || realPath === allowedReal;
      });

      if (!isAllowed) {
        return {
          valid: false,
          error: `Path is outside allowed directories: ${Array.from(this.allowedDirectories).join(', ')}`
        };
      }

      // Check permissions
      const permissionCheck = await this.checkPermissions(realPath, operation);
      if (!permissionCheck.valid) {
        return permissionCheck;
      }

      // Check depth
      const depth = realPath.split(path.sep).length;
      if (depth > this.maxDepth) {
        return { valid: false, error: `Path depth exceeds maximum of ${this.maxDepth}` };
      }

      return { valid: true, resolvedPath: realPath };
    } catch (error) {
      return {
        valid: false,
        error: `Path validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Checks file permissions
   */
  private async checkPermissions(
    targetPath: string,
    operation: 'read' | 'write' | 'execute'
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const permissionFlag = operation === 'read' ? fs.constants.R_OK :
                            operation === 'write' ? fs.constants.W_OK :
                            fs.constants.X_OK;

      await access(targetPath, permissionFlag);
      return { valid: true };
    } catch (error) {
      const opName = operation.charAt(0).toUpperCase() + operation.slice(1);
      return {
        valid: false,
        error: `${opName} permission denied for path`
      };
    }
  }

  /**
   * Checks for path traversal patterns
   */
  private containsEscapeSequences(targetPath: string): boolean {
    const dangerousPatterns = ['..', '~', '/etc', '/root', '/sys', '/proc'];
    return dangerousPatterns.some(pattern => targetPath.includes(pattern));
  }

  /**
   * Adds an allowed directory
   */
  addAllowedDirectory(dir: string): void {
    this.allowedDirectories.add(path.resolve(dir));
  }

  /**
   * Removes an allowed directory
   */
  removeAllowedDirectory(dir: string): void {
    this.allowedDirectories.delete(path.resolve(dir));
  }

  /**
   * Gets all allowed directories
   */
  getAllowedDirectories(): string[] {
    return Array.from(this.allowedDirectories);
  }
}
