import { useState, useCallback } from 'react';
import { getExecutionManager } from '~/lib/modules/agent/execution-manager';
import { ErrorRecovery } from '~/lib/modules/agent/error-recovery';
import type { ExecutionOptions, ExecutionResult } from '~/lib/modules/agent/types';

interface UseAgentOptions {
  agent: string;
  model: string;
  useCache?: boolean;
  enableFallback?: boolean;
  fallbackAgents?: Array<{ agent: string; model: string }>;
  retryCount?: number;
}

export function useAgent(options: UseAgentOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  const execute = useCallback(
    async (executionOptions: Omit<ExecutionOptions, 'agent' | 'model'>) => {
      setLoading(true);
      setError(null);

      try {
        const fullOptions: ExecutionOptions = {
          ...executionOptions,
          agent: options.agent,
          model: options.model,
          useCache: options.useCache ?? true,
          retryCount: options.retryCount ?? 2,
        };

        let executionResult: ExecutionResult;

        if (options.enableFallback && options.fallbackAgents && options.fallbackAgents.length > 0) {
          executionResult = await ErrorRecovery.executeWithFallback(fullOptions, options.fallbackAgents);
        } else {
          executionResult = await ErrorRecovery.executeWithRetry(fullOptions);
        }

        setResult(executionResult);

        if (!executionResult.success) {
          setError(executionResult.error || 'Execution failed');
        }

        // Update metrics
        const manager = getExecutionManager();
        const agentMetrics = manager.getMetrics(options.agent);
        setMetrics(agentMetrics);

        return executionResult;
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        setResult({
          success: false,
          error: errorMessage,
          duration: 0,
          executionId: `error-${Date.now()}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [options],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    execute,
    loading,
    error,
    result,
    metrics,
    clearError,
    clearResult,
  };
}
