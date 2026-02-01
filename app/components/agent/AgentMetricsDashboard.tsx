import { useEffect, useState } from 'react';
import { getExecutionManager } from '~/lib/modules/agent/execution-manager';
import type { AgentMetrics } from '~/lib/modules/agent/types';

interface MetricsDisplayProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function AgentMetricsDashboard({ autoRefresh = true, refreshInterval = 5000 }: MetricsDisplayProps) {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    const manager = getExecutionManager();

    const updateMetrics = () => {
      const allMetrics = manager.getAllMetrics();
      setMetrics(allMetrics);

      // Get cache stats if available
      try {
        const cache = require('~/lib/modules/agent/execution-cache').getExecutionCache();
        if (cache) {
          setCacheStats(cache.getStats());
        }
      } catch {
        // Cache not available
      }
    };

    updateMetrics();

    if (autoRefresh) {
      const interval = setInterval(updateMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (metrics.length === 0) {
    return (
      <div className="p-4 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor">
        <p className="text-bolt-elements-textSecondary text-center">No execution metrics yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.agent}
            className="p-4 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-bolt-elements-textPrimary">{metric.agent}</h3>
              <div
                className={`text-xs px-2 py-1 rounded-full ${
                  metric.successCount > metric.failureCount
                    ? 'bg-green-500/20 text-green-400'
                    : metric.failureCount > 0
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textSecondary'
                }`}
              >
                {metric.totalExecutions} runs
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-bolt-elements-textSecondary">
                <span>Success Rate:</span>
                <span className="text-bolt-elements-textPrimary font-medium">
                  {metric.totalExecutions > 0 ? `${((metric.successCount / metric.totalExecutions) * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between text-bolt-elements-textSecondary">
                <span>Avg Duration:</span>
                <span className="text-bolt-elements-textPrimary font-medium">{metric.averageDuration.toFixed(0)}ms</span>
              </div>

              <div className="flex justify-between text-bolt-elements-textSecondary">
                <span>Total Tokens:</span>
                <span className="text-bolt-elements-textPrimary font-medium">
                  {(metric.totalInputTokens + metric.totalOutputTokens).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-bolt-elements-textSecondary">
                <span>Cache Hits:</span>
                <span className="text-bolt-elements-textPrimary font-medium">{metric.cacheHits}</span>
              </div>

              <div className="pt-2 border-t border-bolt-elements-borderColor">
                <div className="flex gap-2 text-xs">
                  <span className="flex-1 text-center px-2 py-1 bg-green-500/10 text-green-400 rounded">
                    {metric.successCount} ✓
                  </span>
                  <span className="flex-1 text-center px-2 py-1 bg-red-500/10 text-red-400 rounded">
                    {metric.failureCount} ✗
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cacheStats && (
        <div className="p-4 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor">
          <h3 className="font-medium text-bolt-elements-textPrimary mb-3">Cache Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Cache Size</p>
              <p className="text-lg font-bold text-bolt-elements-textPrimary">{cacheStats.size}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Input Tokens</p>
              <p className="text-lg font-bold text-bolt-elements-textPrimary">
                {(cacheStats.totalInputTokens / 1000).toFixed(1)}K
              </p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Output Tokens</p>
              <p className="text-lg font-bold text-bolt-elements-textPrimary">
                {(cacheStats.totalOutputTokens / 1000).toFixed(1)}K
              </p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Total Saved</p>
              <p className="text-lg font-bold text-green-400">
                {(
                  (cacheStats.totalInputTokens + cacheStats.totalOutputTokens) / 1000
                ).toFixed(1)}K
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
