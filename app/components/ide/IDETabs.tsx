import { memo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import * as Tabs from '@radix-ui/react-tabs';
import { ideTabsStore, activeTabStore, removeTab, setActiveTab } from '~/lib/stores/ide-tabs';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';

interface IDETabsProps {
  onTabSelect?: (filePath: string) => void;
  onTabClose?: (filePath: string) => void;
  className?: string;
}

function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    ts: '📘',
    tsx: '⚛️',
    js: '📙',
    jsx: '⚛️',
    json: '{}',
    css: '🎨',
    scss: '🎨',
    html: '🏷️',
    md: '📝',
    py: '🐍',
    java: '☕',
    go: '🐹',
    rs: '🦀',
  };
  return iconMap[ext] || '📄';
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export const IDETabs = memo(({ onTabSelect, onTabClose, className }: IDETabsProps) => {
  renderLogger.trace('IDETabs');

  const tabs = useStore(ideTabsStore);
  const activeTab = useStore(activeTabStore);

  const handleTabSelect = useCallback(
    (filePath: string) => {
      setActiveTab(filePath);
      onTabSelect?.(filePath);
    },
    [onTabSelect],
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, filePath: string) => {
      e.stopPropagation();
      removeTab(filePath);
      onTabClose?.(filePath);
    },
    [onTabClose],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={classNames('border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-x-auto', className)}>
      <Tabs.Root value={activeTab || ''} onValueChange={handleTabSelect}>
        <Tabs.List className="flex gap-1 p-2 w-full">
          {tabs.map((tab) => (
            <Tabs.Trigger
              key={tab.filePath}
              value={tab.filePath}
              className={classNames(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                'data-[state=active]:bg-bolt-elements-item-backgroundActive data-[state=active]:text-bolt-elements-textPrimary',
                'data-[state=inactive]:bg-transparent data-[state=inactive]:text-bolt-elements-textSecondary hover:data-[state=inactive]:bg-bolt-elements-item-backgroundDefault',
              )}
            >
              <span className="text-base">{getFileIcon(tab.filePath)}</span>
              <span>{getFileName(tab.filePath)}</span>
              {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />}
              <button
                onClick={(e) => handleTabClose(e, tab.filePath)}
                className="ml-1 p-0.5 hover:bg-bolt-elements-borderColor rounded transition-colors"
              >
                ✕
              </button>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
});

IDETabs.displayName = 'IDETabs';
