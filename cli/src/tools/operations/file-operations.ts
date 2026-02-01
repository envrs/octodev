import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { PathValidator } from '../validators/path-validator';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

export interface FileOperationOptions {
  maxFileSize?: number;  // bytes
  maxOutputSize?: number; // bytes for returned data
  encoding?: BufferEncoding;
}

export class FileOperations {
  private pathValidator: PathValidator;
  private maxFileSize: number;
  private maxOutputSize: number;
  private encoding: BufferEncoding;

  constructor(validator: PathValidator, options: FileOperationOptions = {}) {
    this.pathValidator = validator;
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxOutputSize = options.maxOutputSize ?? 1024 * 1024; // 1MB for output
    this.encoding = options.encoding ?? 'utf-8';
  }

  /**
   * Reads a file with validation
   */
  async readFile(filePath: string): Promise<{
    success: boolean;
    data?: string;
    truncated?: boolean;
    error?: string;
  }> {
    try {
      // Validate path
      const validation = await this.pathValidator.validatePath(filePath, 'read');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const resolvedPath = validation.resolvedPath!;

      // Check file size
      const stats = await stat(resolvedPath);
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File size (${this.formatBytes(stats.size)}) exceeds maximum (${this.formatBytes(this.maxFileSize)})`
        };
      }

      // Read file
      const content = await readFile(resolvedPath, this.encoding);

      // Truncate output if needed
      let truncated = false;
      let output = content;
      if (content.length > this.maxOutputSize) {
        output = content.substring(0, this.maxOutputSize) + '\n... [truncated]';
        truncated = true;
      }

      return { success: true, data: output, truncated };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Writes to a file with validation and backup
   */
  async writeFile(filePath: string, content: string, options?: { append?: boolean; backup?: boolean }): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    try {
      // Validate path
      const validation = await this.pathValidator.validatePath(filePath, 'write');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const resolvedPath = validation.resolvedPath!;

      // Check content size
      if (content.length > this.maxFileSize) {
        return {
          success: false,
          error: `Content size exceeds maximum (${this.formatBytes(this.maxFileSize)})`
        };
      }

      // Create backup if file exists and backup is requested
      if (options?.backup && fs.existsSync(resolvedPath)) {
        const backupPath = `${resolvedPath}.backup`;
        await copyFile(resolvedPath, backupPath);
      }

      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Write or append
      if (options?.append) {
        await promisify(fs.appendFile)(resolvedPath, content);
      } else {
        await writeFile(resolvedPath, content, this.encoding);
      }

      return { success: true, path: resolvedPath };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Lists directory contents with filtering
   */
  async listDirectory(dirPath: string, options?: { recursive?: boolean; pattern?: RegExp }): Promise<{
    success: boolean;
    files?: Array<{ name: string; type: 'file' | 'directory'; size?: number }>;
    error?: string;
  }> {
    try {
      // Validate path
      const validation = await this.pathValidator.validatePath(dirPath, 'read');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const resolvedPath = validation.resolvedPath!;

      // List directory
      const entries = await readdir(resolvedPath, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        if (options?.pattern && !options.pattern.test(entry.name)) {
          continue;
        }

        const entryPath = path.join(resolvedPath, entry.name);
        const entryStats = await stat(entryPath);

        files.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? entryStats.size : undefined
        });
      }

      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Deletes a file or empty directory
   */
  async deleteFile(filePath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate path
      const validation = await this.pathValidator.validatePath(filePath, 'write');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const resolvedPath = validation.resolvedPath!;

      // Check if path exists
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: 'File or directory not found' };
      }

      // Delete file
      await unlink(resolvedPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Gets file statistics
   */
  async getFileStats(filePath: string): Promise<{
    success: boolean;
    stats?: {
      path: string;
      size: number;
      isFile: boolean;
      isDirectory: boolean;
      created: Date;
      modified: Date;
      accessed: Date;
      permissions: string;
    };
    error?: string;
  }> {
    try {
      // Validate path
      const validation = await this.pathValidator.validatePath(filePath, 'read');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const resolvedPath = validation.resolvedPath!;

      const fileStats = await stat(resolvedPath);

      return {
        success: true,
        stats: {
          path: resolvedPath,
          size: fileStats.size,
          isFile: fileStats.isFile(),
          isDirectory: fileStats.isDirectory(),
          created: fileStats.birthtime,
          modified: fileStats.mtime,
          accessed: fileStats.atime,
          permissions: (fileStats.mode & parseInt('777', 8)).toString(8)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get file stats: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Copies a file
   */
  async copyFile(sourcePath: string, destPath: string, options?: { overwrite?: boolean }): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    try {
      // Validate source
      const sourceValidation = await this.pathValidator.validatePath(sourcePath, 'read');
      if (!sourceValidation.valid) {
        return { success: false, error: `Source: ${sourceValidation.error}` };
      }

      // Validate destination
      const destValidation = await this.pathValidator.validatePath(destPath, 'write');
      if (!destValidation.valid) {
        return { success: false, error: `Destination: ${destValidation.error}` };
      }

      const resolvedSource = sourceValidation.resolvedPath!;
      const resolvedDest = destValidation.resolvedPath!;

      // Check if destination exists
      if (fs.existsSync(resolvedDest) && !options?.overwrite) {
        return {
          success: false,
          error: 'Destination file exists. Use overwrite: true to replace'
        };
      }

      // Ensure destination directory exists
      const destDir = path.dirname(resolvedDest);
      if (!fs.existsSync(destDir)) {
        await mkdir(destDir, { recursive: true });
      }

      // Copy file
      await copyFile(resolvedSource, resolvedDest);

      return { success: true, path: resolvedDest };
    } catch (error) {
      return {
        success: false,
        error: `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Utility to format bytes
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
