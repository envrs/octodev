import { atom, computed } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('IDETabsStore');

export interface IDETab {
  filePath: string;
  isDirty: boolean;
  isActive: boolean;
  icon?: string;
}

export const ideTabsStore = atom<IDETab[]>([]);
export const activeTabStore = atom<string | undefined>();

export const activeTab = computed(
  [ideTabsStore, activeTabStore],
  (tabs, activeTabPath) => tabs.find((t) => t.filePath === activeTabPath),
);

export function addTab(filePath: string, activate = true) {
  const current = ideTabsStore.get();
  const exists = current.some((t) => t.filePath === filePath);

  if (!exists) {
    const newTabs = [
      ...current,
      {
        filePath,
        isDirty: false,
        isActive: activate,
      },
    ];
    ideTabsStore.set(newTabs);
    logger.debug(`Tab added: ${filePath}`);
  }

  if (activate) {
    activeTabStore.set(filePath);
  }
}

export function removeTab(filePath: string) {
  const current = ideTabsStore.get();
  const newTabs = current.filter((t) => t.filePath !== filePath);

  if (newTabs.length === 0) {
    activeTabStore.set(undefined);
  } else if (activeTabStore.get() === filePath) {
    activeTabStore.set(newTabs[newTabs.length - 1].filePath);
  }

  ideTabsStore.set(newTabs);
  logger.debug(`Tab removed: ${filePath}`);
}

export function closeAllTabs() {
  ideTabsStore.set([]);
  activeTabStore.set(undefined);
}

export function setActiveTab(filePath: string) {
  const current = ideTabsStore.get();
  const exists = current.some((t) => t.filePath === filePath);

  if (exists) {
    activeTabStore.set(filePath);
  }
}

export function markTabDirty(filePath: string, isDirty = true) {
  const current = ideTabsStore.get();
  const updated = current.map((t) =>
    t.filePath === filePath ? { ...t, isDirty } : t,
  );
  ideTabsStore.set(updated);
}

export function getTabCount(): number {
  return ideTabsStore.get().length;
}

export function hasUnsavedTabs(): boolean {
  return ideTabsStore.get().some((t) => t.isDirty);
}
