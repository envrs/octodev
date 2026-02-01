import { atom, computed } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('IDELayoutStore');

export type IDEMode = 'side-panel' | 'full-screen' | 'hidden';
export type EditorPosition = 'left' | 'right' | 'bottom';

export interface IDELayout {
  mode: IDEMode;
  position: EditorPosition;
  panelWidth: number; // percentage
  panelHeight: number; // percentage
  isMaximized: boolean;
  showFileTree: boolean;
  showTerminal: boolean;
  terminalHeight: number; // percentage
  selectedEditorTab?: string;
}

const defaultLayout: IDELayout = {
  mode: 'side-panel',
  position: 'right',
  panelWidth: 50,
  panelHeight: 100,
  isMaximized: false,
  showFileTree: true,
  showTerminal: true,
  terminalHeight: 30,
};

export const ideLayoutStore = atom<IDELayout>(defaultLayout);

export const ideMode = computed(ideLayoutStore, (layout) => layout.mode);
export const isIDEFullScreen = computed(ideLayoutStore, (layout) => layout.mode === 'full-screen');
export const isIDESidePanel = computed(ideLayoutStore, (layout) => layout.mode === 'side-panel');
export const isIDEHidden = computed(ideLayoutStore, (layout) => layout.mode === 'hidden');

export function updateIDELayout(updates: Partial<IDELayout>) {
  const current = ideLayoutStore.get();
  ideLayoutStore.set({ ...current, ...updates });
  logger.debug('IDE layout updated', updates);
}

export function toggleIDEMode() {
  const current = ideLayoutStore.get();
  const modes: IDEMode[] = ['side-panel', 'full-screen', 'hidden'];
  const nextModeIndex = (modes.indexOf(current.mode) + 1) % modes.length;
  updateIDELayout({ mode: modes[nextModeIndex] });
}

export function setIDEMode(mode: IDEMode) {
  updateIDELayout({ mode });
  logger.debug(`IDE mode changed to: ${mode}`);
}

export function toggleFileTree() {
  const current = ideLayoutStore.get();
  updateIDELayout({ showFileTree: !current.showFileTree });
}

export function toggleTerminal() {
  const current = ideLayoutStore.get();
  updateIDELayout({ showTerminal: !current.showTerminal });
}

export function maximizeIDE() {
  updateIDELayout({ isMaximized: true });
}

export function minimizeIDE() {
  updateIDELayout({ isMaximized: false });
}
