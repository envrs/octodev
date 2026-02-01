import { atom, computed } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('IDESettingsStore');

export type EditorTheme = 'vs' | 'vs-dark' | 'hc-black';
export type FontFamily = 'fira-code' | 'monaco' | 'source-code-pro' | 'menlo';
export type WordWrap = 'on' | 'off' | 'wordWrapColumn';

export interface IDESettings {
  // Editor
  fontSize: number;
  fontFamily: FontFamily;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: WordWrap;
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  
  // Display
  theme: EditorTheme;
  cursorStyle: 'block' | 'line' | 'underline';
  cursorBlinking: boolean;
  
  // Formatting
  formatOnPaste: boolean;
  formatOnType: boolean;
  trimTrailingWhitespace: boolean;
  trimFinalNewline: boolean;
  
  // Behavior
  autoSave: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  autoSaveDelay: number;
  scrollBeyondLastLine: boolean;
  
  // Features
  breadcrumbs: boolean;
  statusBar: boolean;
  activityBar: boolean;
}

const defaultSettings: IDESettings = {
  fontSize: 13,
  fontFamily: 'fira-code',
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  theme: 'vs-dark',
  cursorStyle: 'block',
  cursorBlinking: true,
  formatOnPaste: true,
  formatOnType: true,
  trimTrailingWhitespace: false,
  trimFinalNewline: false,
  autoSave: 'afterDelay',
  autoSaveDelay: 1000,
  scrollBeyondLastLine: false,
  breadcrumbs: true,
  statusBar: true,
  activityBar: true,
};

export const ideSettingsStore = atom<IDESettings>(defaultSettings);

export const editorFontSize = computed(ideSettingsStore, (s) => s.fontSize);
export const editorTheme = computed(ideSettingsStore, (s) => s.theme);
export const editorTabSize = computed(ideSettingsStore, (s) => s.tabSize);

export function updateSetting<K extends keyof IDESettings>(key: K, value: IDESettings[K]) {
  const current = ideSettingsStore.get();
  ideSettingsStore.set({ ...current, [key]: value });
  logger.debug(`IDE setting updated: ${key} = ${value}`);
  
  // Persist to localStorage
  try {
    localStorage.setItem('ide-settings', JSON.stringify(ideSettingsStore.get()));
  } catch (e) {
    logger.error('Failed to persist IDE settings', e);
  }
}

export function updateSettings(updates: Partial<IDESettings>) {
  const current = ideSettingsStore.get();
  const newSettings = { ...current, ...updates };
  ideSettingsStore.set(newSettings);
  
  // Persist to localStorage
  try {
    localStorage.setItem('ide-settings', JSON.stringify(newSettings));
  } catch (e) {
    logger.error('Failed to persist IDE settings', e);
  }
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem('ide-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      ideSettingsStore.set({ ...defaultSettings, ...parsed });
    }
  } catch (e) {
    logger.error('Failed to load IDE settings', e);
  }
}

export function resetSettings() {
  ideSettingsStore.set(defaultSettings);
  localStorage.removeItem('ide-settings');
}
