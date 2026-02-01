import { memo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { ideSettingsStore, updateSetting, updateSettings, resetSettings } from '~/lib/stores/ide-settings';
import type { IDESettings } from '~/lib/stores/ide-settings';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';

interface IDESettingsPanelProps {
  onClose?: () => void;
  className?: string;
}

const SettingSection = memo(
  ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="pb-4">
      <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  ),
);

SettingSection.displayName = 'SettingSection';

const SettingRow = memo(
  ({
    label,
    description,
    children,
  }: {
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label className="text-sm font-medium text-bolt-elements-textPrimary">{label}</label>
        {description && (
          <p className="text-xs text-bolt-elements-textTertiary mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  ),
);

SettingRow.displayName = 'SettingRow';

export const IDESettingsPanel = memo(({ onClose, className }: IDESettingsPanelProps) => {
  renderLogger.trace('IDESettingsPanel');

  const settings = useStore(ideSettingsStore);

  const handleNumberChange = useCallback(
    (key: keyof IDESettings, value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        updateSetting(key as any, num as any);
      }
    },
    [],
  );

  const handleBooleanChange = useCallback(
    (key: keyof IDESettings) => {
      const current = settings[key];
      updateSetting(key as any, !current as any);
    },
    [settings],
  );

  const handleSelectChange = useCallback(
    (key: keyof IDESettings, value: string) => {
      updateSetting(key as any, value as any);
    },
    [],
  );

  return (
    <div
      className={classNames(
        'flex flex-col h-full bg-bolt-elements-background-depth-1 overflow-y-auto',
        className,
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor sticky top-0 bg-bolt-elements-background-depth-1 z-10">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">IDE Settings</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <SettingSection title="Editor">
          <SettingRow label="Font Size" description="Editor font size in pixels">
            <input
              type="number"
              min="8"
              max="32"
              value={settings.fontSize}
              onChange={(e) => handleNumberChange('fontSize', e.target.value)}
              className="w-16 px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
            />
          </SettingRow>

          <SettingRow label="Tab Size" description="Number of spaces per tab">
            <input
              type="number"
              min="1"
              max="8"
              value={settings.tabSize}
              onChange={(e) => handleNumberChange('tabSize', e.target.value)}
              className="w-16 px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
            />
          </SettingRow>

          <SettingRow label="Insert Spaces">
            <input
              type="checkbox"
              checked={settings.insertSpaces}
              onChange={() => handleBooleanChange('insertSpaces')}
              className="w-4 h-4 rounded"
            />
          </SettingRow>

          <SettingRow label="Word Wrap">
            <select
              value={settings.wordWrap}
              onChange={(e) => handleSelectChange('wordWrap', e.target.value)}
              className="px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
            >
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="wordWrapColumn">Word Wrap Column</option>
            </select>
          </SettingRow>

          <SettingRow label="Line Numbers">
            <select
              value={settings.lineNumbers}
              onChange={(e) => handleSelectChange('lineNumbers', e.target.value)}
              className="px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
            >
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="relative">Relative</option>
            </select>
          </SettingRow>

          <SettingRow label="Minimap">
            <input
              type="checkbox"
              checked={settings.minimap}
              onChange={() => handleBooleanChange('minimap')}
              className="w-4 h-4 rounded"
            />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Formatting">
          <SettingRow label="Format on Paste">
            <input
              type="checkbox"
              checked={settings.formatOnPaste}
              onChange={() => handleBooleanChange('formatOnPaste')}
              className="w-4 h-4 rounded"
            />
          </SettingRow>

          <SettingRow label="Format on Type">
            <input
              type="checkbox"
              checked={settings.formatOnType}
              onChange={() => handleBooleanChange('formatOnType')}
              className="w-4 h-4 rounded"
            />
          </SettingRow>

          <SettingRow label="Trim Trailing Whitespace">
            <input
              type="checkbox"
              checked={settings.trimTrailingWhitespace}
              onChange={() => handleBooleanChange('trimTrailingWhitespace')}
              className="w-4 h-4 rounded"
            />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Auto Save">
          <SettingRow label="Auto Save" description="When to save files automatically">
            <select
              value={settings.autoSave}
              onChange={(e) => handleSelectChange('autoSave', e.target.value)}
              className="px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
            >
              <option value="off">Off</option>
              <option value="afterDelay">After Delay</option>
              <option value="onFocusChange">On Focus Change</option>
              <option value="onWindowChange">On Window Change</option>
            </select>
          </SettingRow>

          {settings.autoSave === 'afterDelay' && (
            <SettingRow label="Auto Save Delay (ms)">
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={settings.autoSaveDelay}
                onChange={(e) => handleNumberChange('autoSaveDelay', e.target.value)}
                className="w-24 px-2 py-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
              />
            </SettingRow>
          )}
        </SettingSection>
      </div>

      <div className="p-4 border-t border-bolt-elements-borderColor">
        <button
          onClick={resetSettings}
          className="w-full px-3 py-2 rounded-lg bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary font-medium text-sm transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
});

IDESettingsPanel.displayName = 'IDESettingsPanel';
