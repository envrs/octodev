import { memo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  ideLayoutStore,
  setIDEMode,
  toggleFileTree,
  toggleTerminal,
  type IDEMode,
} from '~/lib/stores/ide-layout';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';

interface IDEModeToggleProps {
  className?: string;
}

const modeOptions: { value: IDEMode; label: string; icon: string; description: string }[] = [
  {
    value: 'side-panel',
    label: 'Side Panel',
    icon: '⟨',
    description: 'Editor as side panel alongside chat',
  },
  {
    value: 'full-screen',
    label: 'Full Screen',
    icon: '⛶',
    description: 'Full screen IDE view',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    icon: '✕',
    description: 'Hide IDE',
  },
];

export const IDEModeToggle = memo(({ className }: IDEModeToggleProps) => {
  renderLogger.trace('IDEModeToggle');

  const layout = useStore(ideLayoutStore);

  const handleModeChange = useCallback((mode: IDEMode) => {
    setIDEMode(mode);
  }, []);

  const currentModeOption = modeOptions.find((opt) => opt.value === layout.mode);

  return (
    <DropdownMenu.Root>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <DropdownMenu.Trigger asChild>
              <button
                className={classNames(
                  'p-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-item-backgroundActive/80',
                  className,
                )}
                aria-label="IDE mode toggle"
              >
                {currentModeOption?.icon} IDE
              </button>
            </DropdownMenu.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <span className="text-xs">Toggle IDE mode</span>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>

      <DropdownMenu.Content
        align="start"
        className="min-w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg p-1"
      >
        <div className="px-3 py-2 text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
          IDE Mode
        </div>

        {modeOptions.map((option) => (
          <DropdownMenu.Item
            key={option.value}
            onClick={() => handleModeChange(option.value)}
            className={classNames(
              'flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
              layout.mode === option.value
                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundDefault hover:text-bolt-elements-textPrimary',
            )}
          >
            <span className="text-base mt-px">{option.icon}</span>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-bolt-elements-textTertiary">{option.description}</span>
            </div>
          </DropdownMenu.Item>
        ))}

        <DropdownMenu.Separator className="my-1 h-px bg-bolt-elements-borderColor" />

        <div className="px-3 py-2 text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
          Panels
        </div>

        <DropdownMenu.Item
          onClick={toggleFileTree}
          className={classNames(
            'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
            layout.showFileTree
              ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundDefault',
          )}
        >
          <span>{layout.showFileTree ? '✓' : '○'}</span>
          <span>File Explorer</span>
        </DropdownMenu.Item>

        <DropdownMenu.Item
          onClick={toggleTerminal}
          className={classNames(
            'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
            layout.showTerminal
              ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundDefault',
          )}
        >
          <span>{layout.showTerminal ? '✓' : '○'}</span>
          <span>Terminal</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});

IDEModeToggle.displayName = 'IDEModeToggle';
