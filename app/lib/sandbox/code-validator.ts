/**
 * AST-based code validator for sandbox execution
 * Detects dangerous operations and validates code safety
 */

import { createScopedLogger } from '~/utils/logger';
import type { ValidationLevel, ValidationResult, DangerousOperation, ValidationIssue } from '~/types/sandbox';
import { DANGEROUS_OPERATIONS } from '~/types/sandbox';

const logger = createScopedLogger('CodeValidator');

// Simple regex-based pattern matching for dangerous operations
// This is a lightweight alternative when full AST parsing isn't available
class SimpleCodeAnalyzer {
  private code: string;
  private lines: string[];

  constructor(code: string) {
    this.code = code;
    this.lines = code.split('\n');
  }

  private findPattern(pattern: RegExp, category: keyof typeof DANGEROUS_OPERATIONS): DangerousOperation[] {
    const results: DangerousOperation[] = [];
    const operations = DANGEROUS_OPERATIONS[category];

    this.lines.forEach((line, lineIndex) => {
      operations.forEach((op) => {
        // Match the operation as a method call or import
        const regex = new RegExp(`\\b${op}\\s*[(\\.\\s]`, 'g');
        let match;

        while ((match = regex.exec(line)) !== null) {
          results.push({
            operation: op,
            category,
            location: {
              line: lineIndex + 1,
              column: match.index,
            },
            description: this.getOperationDescription(category, op),
          });
        }
      });
    });

    return results;
  }

  private getOperationDescription(
    category: keyof typeof DANGEROUS_OPERATIONS,
    operation: string,
  ): string {
    const descriptions: Record<keyof typeof DANGEROUS_OPERATIONS, string> = {
      FILE_DELETE: `Deletes files from the filesystem: ${operation}`,
      PROCESS_EXEC: `Executes external processes: ${operation}`,
      FILE_WRITE: `Writes to filesystem: ${operation}`,
      NETWORK: `Makes network requests: ${operation}`,
      EVAL: `Executes dynamic code: ${operation}`,
      REQUIRE_DYNAMIC: `Dynamically loads modules: ${operation}`,
    };

    return descriptions[category];
  }

  analyze(): {
    dangerousOperations: DangerousOperation[];
    issues: ValidationIssue[];
  } {
    const dangerousOperations: DangerousOperation[] = [];
    const issues: ValidationIssue[] = [];

    // Scan for dangerous operations
    (Object.keys(DANGEROUS_OPERATIONS) as Array<keyof typeof DANGEROUS_OPERATIONS>).forEach(
      (category) => {
        const found = this.findPattern(/./g, category);
        dangerousOperations.push(...found);
      },
    );

    // Check for common security issues
    if (this.code.includes('eval(')) {
      issues.push({
        type: 'dangerous-operation',
        severity: 'error',
        message: 'eval() detected - arbitrary code execution is not allowed',
        suggestion: 'Use JSON.parse() or other safe alternatives instead',
      });
    }

    if (this.code.includes('Function(')) {
      issues.push({
        type: 'dangerous-operation',
        severity: 'error',
        message: 'Function constructor detected - can execute arbitrary code',
        suggestion: 'Use predefined functions or safer alternatives',
      });
    }

    if (this.code.match(/require\s*\(\s*['"`]/)) {
      issues.push({
        type: 'dangerous-operation',
        severity: 'warning',
        message: 'Dynamic require() detected',
        suggestion: 'Use static imports when possible',
      });
    }

    // Check code size
    if (this.code.length > 1024 * 1024) {
      // 1MB
      issues.push({
        type: 'resource-limit',
        severity: 'warning',
        message: 'Code size exceeds 1MB - may impact execution performance',
      });
    }

    return { dangerousOperations, issues };
  }
}

export class CodeValidator {
  private code: string;
  private validationLevel: ValidationLevel;

  constructor(code: string, validationLevel: ValidationLevel = 'moderate') {
    this.code = code;
    this.validationLevel = validationLevel;
  }

  /**
   * Validate code against security rules
   */
  validate(): ValidationResult {
    const analyzer = new SimpleCodeAnalyzer(this.code);
    const analysis = analyzer.analyze();

    // Determine if code is valid based on validation level
    const isValid = this.determineValidity(analysis);
    const severity = this.determineSeverity(analysis);

    return {
      level: this.validationLevel,
      isValid,
      issues: analysis.issues,
      dangerousOperations: analysis.dangerousOperations,
      severity,
    };
  }

  /**
   * Determine if code should execute based on validation level
   */
  private determineValidity(analysis: {
    dangerousOperations: DangerousOperation[];
    issues: ValidationIssue[];
  }): boolean {
    const criticalIssues = analysis.issues.filter((i) => i.severity === 'error');

    switch (this.validationLevel) {
      case 'strict':
        // Strict: no dangerous operations allowed
        return (
          analysis.dangerousOperations.length === 0 &&
          criticalIssues.length === 0
        );

      case 'moderate':
        // Moderate: critical issues block execution
        return criticalIssues.length === 0;

      case 'permissive':
        // Permissive: only block on extreme issues
        return true;

      default:
        return false;
    }
  }

  /**
   * Determine overall severity level
   */
  private determineSeverity(analysis: {
    dangerousOperations: DangerousOperation[];
    issues: ValidationIssue[];
  }): 'safe' | 'warning' | 'critical' {
    const hasCritical = analysis.issues.some((i) => i.severity === 'error');
    const hasWarning = analysis.issues.some((i) => i.severity === 'warning');
    const hasDangerousOps = analysis.dangerousOperations.length > 0;

    if (hasCritical) {
      return 'critical';
    }

    if (hasWarning || hasDangerousOps) {
      return 'warning';
    }

    return 'safe';
  }

  /**
   * Get human-readable validation summary
   */
  getSummary(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push(`Validation Level: ${result.level}`);
    lines.push(`Status: ${result.isValid ? 'PASS' : 'FAIL'}`);
    lines.push(`Severity: ${result.severity}`);

    if (result.issues.length > 0) {
      lines.push(`\nIssues (${result.issues.length}):`);
      result.issues.forEach((issue, i) => {
        lines.push(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`     Suggestion: ${issue.suggestion}`);
        }
      });
    }

    if (result.dangerousOperations.length > 0) {
      lines.push(`\nDangerous Operations (${result.dangerousOperations.length}):`);
      result.dangerousOperations.slice(0, 5).forEach((op, i) => {
        const location = op.location ? ` (Line ${op.location.line})` : '';
        lines.push(`  ${i + 1}. ${op.operation} - ${op.description}${location}`);
      });

      if (result.dangerousOperations.length > 5) {
        lines.push(`  ... and ${result.dangerousOperations.length - 5} more`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Quick validation helper
 */
export function validateCode(
  code: string,
  level: ValidationLevel = 'moderate',
): ValidationResult {
  const validator = new CodeValidator(code, level);
  return validator.validate();
}

/**
 * Check if code requires approval
 */
export function requiresApproval(result: ValidationResult): boolean {
  return result.severity === 'critical' || result.severity === 'warning';
}
