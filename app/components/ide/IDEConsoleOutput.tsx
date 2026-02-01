import { memo, useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';

export interface ConsoleEntry {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
  stackTrace?: string;
}

interface IDEConsoleOutputProps {
  entries?: ConsoleEntry[];
  maxEntries?: number;
  onClear?: () => void;
  className?: string;
}

const typeColors = {
  log: 'text-bolt-elements-textPrimary',
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  debug: 'text-purple-400',
};

const typeLabels = {
  log: '[LOG]',
  error: '[ERROR]',
  warn: '[WARN]',
  info: '[INFO]',
  debug: '[DEBUG]',
};

export const IDEConsoleOutput = memo(
  ({ entries = [], maxEntries = 1000, onClear, className }: IDEConsoleOutputProps) => {
    renderLogger.trace('IDEConsoleOutput');

    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
      if (autoScroll && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [entries, autoScroll]);

    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(isAtBottom);
    };

    // Keep only the last maxEntries
    const displayEntries = entries.slice(-maxEntries);

    return (
      <div className={classNames('flex flex-col h-full bg-bolt-elements-background-depth-1', className)}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-bolt-elements-borderColor">
          <span className="text-sm font-medium text-bolt-elements-textSecondary">
            Console ({displayEntries.length})
          </span>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs text-bolt-elements-textTertiary cursor-pointer hover:text-bolt-elements-textSecondary">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3"
              />
              Auto-scroll
            </label>
            <button
              onClick={onClear}
              className="px-2 py-1 text-xs rounded bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto font-mono text-xs space-y-px p-3"
        >
          {displayEntries.length === 0 ? (
            <div className="text-bolt-elements-textTertiary select-none">
              Console output will appear here...
            </div>
          ) : (
            displayEntries.map((entry) => (
              <div
                key={entry.id}
                className={classNames(
                  'flex gap-2 py-px leading-relaxed',
                  typeColors[entry.type],
                )}
              >
                <span className="flex-shrink-0 text-bolt-elements-textTertiary">
                  {typeLabels[entry.type]}
                </span>
                <span className="break-words">
                  {entry.message}
                  {entry.source && (
                    <span className="ml-2 text-bolt-elements-textTertiary">
                      ({entry.source})
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
);

IDEConsoleOutput.displayName = 'IDEConsoleOutput';
