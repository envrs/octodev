import type { ExecutionLog } from '~/types/sandbox';

interface ExecutionMonitorProps {
  log: ExecutionLog;
}

export function ExecutionMonitor({ log }: ExecutionMonitorProps) {
  const statusColors: Record<ExecutionLog['status'], string> = {
    pending: 'bg-gray-500/10 border-gray-500/20',
    running: 'bg-blue-500/10 border-blue-500/20',
    success: 'bg-green-500/10 border-green-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    timeout: 'bg-yellow-500/10 border-yellow-500/20',
    aborted: 'bg-orange-500/10 border-orange-500/20',
  };

  const statusTextColors: Record<ExecutionLog['status'], string> = {
    pending: 'text-gray-400',
    running: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    timeout: 'text-yellow-400',
    aborted: 'text-orange-400',
  };

  const memoryUsagePercent = Math.random() * 60; // Simulated
  const cpuUsagePercent = Math.random() * 40; // Simulated

  return (
    <div className="grid grid-cols-2 gap-3 p-3 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded">
      {/* Status */}
      <div className={`p-2 rounded border ${statusColors[log.status]}`}>
        <div className="text-xs text-bolt-elements-textSecondary mb-1">Status</div>
        <div className={`text-sm font-semibold ${statusTextColors[log.status]}`}>
          {log.status.toUpperCase()}
        </div>
      </div>

      {/* Duration */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">Duration</div>
        <div className="text-sm font-semibold text-bolt-elements-textPrimary">
          {log.duration ? `${log.duration}ms` : 'N/A'}
        </div>
      </div>

      {/* Memory Usage */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">Memory</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-bolt-elements-bg-depth-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 transition-all duration-300"
              style={{ width: `${memoryUsagePercent}%` }}
            />
          </div>
          <div className="text-sm font-semibold text-bolt-elements-textPrimary">
            {memoryUsagePercent.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* CPU Usage */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">CPU</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-bolt-elements-bg-depth-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 transition-all duration-300"
              style={{ width: `${cpuUsagePercent}%` }}
            />
          </div>
          <div className="text-sm font-semibold text-bolt-elements-textPrimary">
            {cpuUsagePercent.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Output Size */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">Output</div>
        <div className="text-sm font-semibold text-bolt-elements-textPrimary">
          {(log.output.length / 1024).toFixed(1)} KB
        </div>
      </div>

      {/* File Operations Count */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">File Ops</div>
        <div className="text-sm font-semibold text-bolt-elements-textPrimary">
          {log.fileOperations.length}
        </div>
      </div>

      {/* Exit Code */}
      {log.exitCode !== undefined && (
        <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
          <div className="text-xs text-bolt-elements-textSecondary mb-1">Exit Code</div>
          <div className="text-sm font-semibold text-bolt-elements-textPrimary">
            {log.exitCode}
          </div>
        </div>
      )}

      {/* Execution Type */}
      <div className="p-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1">
        <div className="text-xs text-bolt-elements-textSecondary mb-1">Type</div>
        <div className="text-sm font-semibold text-bolt-elements-textPrimary">
          {log.executionType}
        </div>
      </div>
    </div>
  );
}
