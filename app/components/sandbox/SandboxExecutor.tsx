import { useCallback, useEffect, useState, useRef } from 'react';
import type { SandboxConfig, ExecutionLog, ValidationResult } from '~/types/sandbox';
import { SandboxLogs } from './SandboxLogs';
import { ExecutionMonitor } from './ExecutionMonitor';
import { CodeValidator } from '~/lib/sandbox/code-validator';

interface SandboxExecutorProps {
  config: SandboxConfig;
  onExecutionComplete?: (log: ExecutionLog) => void;
}

export function SandboxExecutor({ config, onExecutionComplete }: SandboxExecutorProps) {
  const [code, setCode] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<ExecutionLog | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate code on change
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);

    // Perform validation
    const validator = new CodeValidator(newCode, config.validationLevel);
    const result = validator.validate();
    setValidationResult(result);

    // Check if approval is needed
    const hasWarnings = result.severity === 'warning' || result.severity === 'critical';
    setRequiresApproval(hasWarnings);
  }, [config.validationLevel]);

  // Execute code
  const handleExecute = useCallback(async () => {
    if (!code.trim()) {
      alert('Please enter code to execute');
      return;
    }

    // Validate before execution
    const validator = new CodeValidator(code, config.validationLevel);
    const result = validator.validate();

    if (!result.isValid) {
      alert('Code validation failed:\n' + validator.getSummary(result));
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/sandbox.execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: config.id,
          config,
          code,
          priority: 'normal',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // In a real implementation, would receive execution ID and stream logs
      // For now, simulate execution result
      const mockLog: ExecutionLog = {
        id: `log-${Date.now()}`,
        sandboxId: config.id,
        executionType: config.executionType,
        language: config.language,
        code,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        duration: 100,
        status: 'success',
        output: 'Code executed successfully',
        errors: '',
        warnings: result.issues.map((i) => i.message),
        fileOperations: [],
        networkRequests: [],
        validationResult: result,
      };

      setExecutionLog(mockLog);
      onExecutionComplete?.(mockLog);
    } catch (error) {
      alert('Execution failed: ' + String(error));
    } finally {
      setIsExecuting(false);
    }
  }, [code, config, onExecutionComplete]);

  // Clear code and logs
  const handleClear = useCallback(() => {
    setCode('');
    setExecutionLog(null);
    setValidationResult(null);
    setRequiresApproval(false);
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-bolt-elements-bg-depth-1 rounded-lg border border-bolt-elements-borderColor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">
          Sandbox Executor
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-1 text-sm rounded bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !code.trim() || !validationResult?.isValid}
            className="px-3 py-1 text-sm rounded bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {validationResult && (
        <div
          className={`p-3 rounded text-sm border ${
            validationResult.isValid
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <div className="font-medium">
            {validationResult.isValid ? 'Validation Passed' : 'Validation Failed'}
          </div>
          {validationResult.issues.length > 0 && (
            <div className="text-xs mt-1">
              {validationResult.issues.length} issue(s) found
            </div>
          )}
          {requiresApproval && (
            <div className="text-xs mt-1 text-yellow-400">
              This code requires approval before execution
            </div>
          )}
        </div>
      )}

      {/* Code Editor */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <label className="text-sm font-medium text-bolt-elements-textSecondary">
          Code ({config.language})
        </label>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="Enter code to execute..."
          className="flex-1 p-3 rounded bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm font-mono resize-none focus:outline-none focus:border-bolt-elements-borderColorActive"
        />
      </div>

      {/* Execution Monitor */}
      {executionLog && <ExecutionMonitor log={executionLog} />}

      {/* Logs Viewer */}
      {executionLog && (
        <SandboxLogs
          logs={[executionLog]}
          onSelectLog={(log) => setExecutionLog(log)}
        />
      )}
    </div>
  );
}
