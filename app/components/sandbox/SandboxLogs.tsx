import { useEffect, useRef, useState } from 'react';
import type { ExecutionLog } from '~/types/sandbox';

interface SandboxLogsProps {
  logs: ExecutionLog[];
  onSelectLog?: (log: ExecutionLog) => void;
}

export function SandboxLogs({ logs, onSelectLog }: SandboxLogsProps) {
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(logs[0] || null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedLog?.output, autoScroll]);

  // Update selected log if it changes
  useEffect(() => {
    if (logs.length > 0 && !selectedLog) {
      setSelectedLog(logs[logs.length - 1]);
    }
  }, [logs, selectedLog]);

  if (!selectedLog) {
    return (
      <div className="p-4 text-center text-bolt-elements-textSecondary">
        No logs available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-96 border border-bolt-elements-borderColor rounded overflow-hidden">
      {/* Log List Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bolt-elements-bg-depth-2 border-b border-bolt-elements-borderColor">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">
          Execution Logs
        </h3>
        <label className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll
        </label>
      </div>

      {/* Log Output Area */}
      <div className="flex-1 overflow-auto p-3 bg-bolt-elements-bg-depth-1 font-mono text-xs space-y-1 modern-scrollbar">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              selectedLog.status === 'success'
                ? 'bg-green-500'
                : selectedLog.status === 'error'
                  ? 'bg-red-500'
                  : selectedLog.status === 'timeout'
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
            }`}
          />
          <span className="text-bolt-elements-textSecondary">
            {selectedLog.status.toUpperCase()}
            {selectedLog.duration && ` (${selectedLog.duration}ms)`}
          </span>
        </div>

        {/* Output */}
        {selectedLog.output && (
          <div className="mt-2">
            <div className="text-bolt-elements-textTertiary mb-1">Output:</div>
            {selectedLog.output.split('\n').map((line, i) => (
              <div
                key={i}
                className={`text-bolt-elements-textPrimary ${
                  line.startsWith('[ERROR]')
                    ? 'text-red-400'
                    : line.startsWith('[WARNING]')
                      ? 'text-yellow-400'
                      : line.startsWith('[INFO]')
                        ? 'text-blue-400'
                        : ''
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Errors */}
        {selectedLog.errors && (
          <div className="mt-2">
            <div className="text-red-400 mb-1">Errors:</div>
            {selectedLog.errors.split('\n').map((line, i) => (
              <div key={i} className="text-red-400">
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {selectedLog.warnings.length > 0 && (
          <div className="mt-2">
            <div className="text-yellow-400 mb-1">Warnings ({selectedLog.warnings.length}):</div>
            {selectedLog.warnings.map((warning, i) => (
              <div key={i} className="text-yellow-400">
                {i + 1}. {warning}
              </div>
            ))}
          </div>
        )}

        {/* File Operations */}
        {selectedLog.fileOperations.length > 0 && (
          <div className="mt-2">
            <div className="text-blue-400 mb-1">File Operations ({selectedLog.fileOperations.length}):</div>
            {selectedLog.fileOperations.map((op, i) => (
              <div key={i} className="text-blue-400">
                {op.operation.toUpperCase()} {op.path}
              </div>
            ))}
          </div>
        )}

        {/* Network Requests */}
        {selectedLog.networkRequests.length > 0 && (
          <div className="mt-2">
            <div className="text-cyan-400 mb-1">
              Network Requests ({selectedLog.networkRequests.length}):
            </div>
            {selectedLog.networkRequests.map((req, i) => (
              <div key={i} className="text-cyan-400">
                {req.method} {req.url}
                {req.blocked && ' [BLOCKED]'}
              </div>
            ))}
          </div>
        )}

        <div ref={logsEndRef} />
      </div>

      {/* Log Details */}
      <div className="flex gap-2 px-3 py-2 text-xs text-bolt-elements-textSecondary bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor">
        <span>ID: {selectedLog.id}</span>
        <span>•</span>
        <span>Type: {selectedLog.executionType}</span>
        <span>•</span>
        <span>Exit Code: {selectedLog.exitCode ?? 'N/A'}</span>
      </div>
    </div>
  );
}
