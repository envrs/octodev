'use client';

import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { figmaImportStore } from '~/lib/stores/figma-import';
import type { FigmaImportRequest } from '~/types/figma';

interface FigmaImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: FigmaImportRequest) => Promise<void>;
}

export const FigmaImportDialog: React.FC<FigmaImportDialogProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const isImporting = useStore(figmaImportStore.isImporting);
  const error = useStore(figmaImportStore.error);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!figmaUrl.trim()) {
      figmaImportStore.error.set('Please enter a Figma URL');
      return;
    }

    if (!figmaToken.trim()) {
      figmaImportStore.error.set('Please enter your Figma API token');
      return;
    }

    try {
      figmaImportStore.isImporting.set(true);
      figmaImportStore.error.set(undefined);

      await onImport({
        figmaUrl: figmaUrl.trim(),
        figmaToken: figmaToken.trim(),
      });

      setFigmaUrl('');
      setFigmaToken('');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import Figma design';
      figmaImportStore.error.set(message);
    } finally {
      figmaImportStore.isImporting.set(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Import from Figma
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">
              Figma File URL
            </label>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/file/..."
              className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 px-3 py-2 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive focus:outline-none"
              disabled={isImporting}
            />
            <p className="mt-1 text-xs text-bolt-elements-textTertiary">
              Copy the URL from your Figma file (must have view access)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">
              Figma API Token
            </label>
            <input
              type="password"
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
              placeholder="figd_xxxxxxxxx"
              className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 px-3 py-2 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive focus:outline-none"
              disabled={isImporting}
            />
            <p className="mt-1 text-xs text-bolt-elements-textTertiary">
              Get your token from{' '}
              <a
                href="https://www.figma.com/developers/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bolt-elements-item-contentAccent hover:underline"
              >
                Figma API settings
              </a>
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 px-4 py-2 text-sm font-medium text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="flex-1 rounded-lg bg-bolt-elements-item-contentAccent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FigmaImportDialog;
