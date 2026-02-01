import { atom, type WritableAtom } from 'nanostores';
import type { FigmaImportState, FigmaImportResult } from '~/types/figma';

export interface FigmaImportStore {
  isImporting: WritableAtom<boolean>;
  currentImport: WritableAtom<FigmaImportResult | undefined>;
  importHistory: WritableAtom<FigmaImportResult[]>;
  error: WritableAtom<string | undefined>;
  figmaToken: WritableAtom<string>;
}

const createFigmaImportStore = (): FigmaImportStore => {
  const isImporting = atom(false);
  const currentImport = atom<FigmaImportResult | undefined>(undefined);
  const importHistory = atom<FigmaImportResult[]>([]);
  const error = atom<string | undefined>(undefined);
  const figmaToken = atom('');

  return {
    isImporting,
    currentImport,
    importHistory,
    error,
    figmaToken,
  };
};

export const figmaImportStore = createFigmaImportStore();

export const addImportToHistory = (result: FigmaImportResult) => {
  const history = figmaImportStore.importHistory.get();
  figmaImportStore.importHistory.set([result, ...history].slice(0, 20));
};

export const clearImportError = () => {
  figmaImportStore.error.set(undefined);
};

export const setImporting = (isImporting: boolean) => {
  figmaImportStore.isImporting.set(isImporting);
};

export const setImportError = (error: string) => {
  figmaImportStore.error.set(error);
  figmaImportStore.isImporting.set(false);
};
