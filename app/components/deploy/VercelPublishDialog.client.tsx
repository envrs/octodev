import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useVercelPublish } from './useVercelPublish';
import type { PublishedVersion } from '~/types/vercel';
import { classNames } from '~/utils/classNames';

interface VercelPublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
}

export function VercelPublishDialog({
  isOpen,
  onClose,
  projectId,
  projectName = 'Project',
}: VercelPublishDialogProps) {
  const { handleVercelPublish, isPublishing, publishError, getPublishedVersions, copyToClipboard } =
    useVercelPublish();
  const [customLabel, setCustomLabel] = useState('');
  const [publishedVersion, setPublishedVersion] = useState<PublishedVersion | null>(null);
  const publishedVersions = getPublishedVersions(projectId);

  const handlePublish = async () => {
    const result = await handleVercelPublish(projectId, customLabel);
    if (result) {
      setPublishedVersion(result);
      setCustomLabel('');
    }
  };

  const handleCopyUrl = async (url: string) => {
    await copyToClipboard(url);
  };

  const getDisplayUrl = (version: PublishedVersion): string => {
    return version.shareableUrl;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className={classNames(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-2xl',
            'bg-bolt-elements-background-depth-1',
            'border border-bolt-elements-borderColor',
            'rounded-lg shadow-xl',
            'p-6',
            'max-h-[80vh] overflow-y-auto',
          )}
        >
          <Dialog.Title className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">
            Publish {projectName} to Vercel
          </Dialog.Title>

          {/* Publish Section */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Version Label (Optional)
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., v1.0, Production, Feature Release"
                disabled={isPublishing}
                className={classNames(
                  'w-full px-3 py-2',
                  'bg-bolt-elements-background-depth-2',
                  'border border-bolt-elements-borderColor',
                  'rounded-md',
                  'text-bolt-elements-textPrimary',
                  'placeholder-bolt-elements-textTertiary',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus:ring-2 focus:ring-accent-500',
                )}
              />
              <p className="text-xs text-bolt-elements-textTertiary mt-1">
                If not specified, a timestamp will be used automatically
              </p>
            </div>

            {publishError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{publishError}</p>
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className={classNames(
                'w-full px-4 py-2',
                'bg-accent-500 hover:bg-accent-600 disabled:bg-accent-500 disabled:opacity-60',
                'text-white font-medium',
                'rounded-md',
                'transition-colors',
                'disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {isPublishing ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Publishing...
                </>
              ) : (
                'Publish Now'
              )}
            </button>
          </div>

          {/* Recently Published Version */}
          {publishedVersion && (
            <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md p-4 mb-6">
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Just Published!</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bolt-elements-textTertiary">Version:</span>
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">
                    {publishedVersion.versionLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bolt-elements-textTertiary">URL:</span>
                  <a
                    href={publishedVersion.shareableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-500 hover:text-accent-600 truncate"
                  >
                    {publishedVersion.shareableUrl}
                  </a>
                </div>
                <button
                  onClick={() => handleCopyUrl(publishedVersion.shareableUrl)}
                  className="text-xs bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary px-2 py-1 rounded transition-colors"
                >
                  Copy URL
                </button>
              </div>
            </div>
          )}

          {/* Publishing History */}
          {publishedVersions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Publishing History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {publishedVersions.map((version, index) => (
                  <div
                    key={index}
                    className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-bolt-elements-textPrimary">{version.versionLabel}</div>
                        <div className="text-xs text-bolt-elements-textTertiary truncate">
                          {getDisplayUrl(version)}
                        </div>
                        <div className="text-xs text-bolt-elements-textTertiary mt-1">
                          {new Date(version.publishedAt).toLocaleDateString()} at{' '}
                          {new Date(version.publishedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopyUrl(version.shareableUrl)}
                        className="text-xs bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary px-2 py-1 rounded whitespace-nowrap transition-colors flex-shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {publishedVersions.length === 0 && !publishedVersion && (
            <div className="text-center py-8 text-bolt-elements-textTertiary">
              <p className="text-sm">No published versions yet. Publish your first version above!</p>
            </div>
          )}

          <Dialog.Close
            className="absolute right-4 top-4 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
            onClick={onClose}
          >
            <span className="text-lg">✕</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
