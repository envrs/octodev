import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { vercelConnection } from '~/lib/stores/vercel';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  addPublishedVersion,
  getProjectPublished,
  isPublishing as isPublishingStore,
  publishError as publishErrorStore,
  lastPublished,
} from '~/lib/stores/vercel-publish';
import type { PublishedVersion } from '~/types/vercel';

export function useVercelPublish() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const vercelConn = useStore(vercelConnection);
  const publishStore = useStore(isPublishingStore);
  const errorStore = useStore(publishErrorStore);

  const handleVercelPublish = async (projectId?: string, customLabel?: string): Promise<PublishedVersion | null> => {
    if (!vercelConn.user || !vercelConn.token) {
      const errorMsg = 'Please connect to Vercel first in the settings tab!';
      toast.error(errorMsg);
      setPublishError(errorMsg);
      return null;
    }

    try {
      setIsPublishing(true);
      setPublishError(null);

      // Get the project ID - either from parameter or from the active artifact
      let targetProjectId = projectId;

      if (!targetProjectId) {
        // Try to get from artifact metadata
        const artifact = workbenchStore.firstArtifact;
        if (artifact && (artifact as any).projectId) {
          targetProjectId = (artifact as any).projectId;
        }
      }

      if (!targetProjectId) {
        throw new Error('No project ID found. Please deploy to Vercel first before publishing.');
      }

      console.log('[v0] Publishing project:', targetProjectId);
      toast.info('Publishing version to Vercel...');

      // Call the publish API endpoint
      const response = await fetch('/api/vercel-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: targetProjectId,
          customLabel: customLabel || undefined,
          token: vercelConn.token,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.error || 'Failed to publish');
      }

      const publishData = (await response.json()) as { published?: PublishedVersion; success?: boolean };

      if (!publishData.published) {
        throw new Error('Invalid response from publish endpoint');
      }

      // Store the published version
      addPublishedVersion(publishData.published);

      // Show success message with the shareable URL
      toast.success(`Published! Share this link: ${publishData.published.shareableUrl}`);

      console.log('[v0] Publish successful:', publishData.published);
      setIsPublishing(false);

      return publishData.published;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Publish failed';
      console.error('[v0] Publish error:', error);
      setPublishError(errorMsg);
      toast.error(`Publish failed: ${errorMsg}`);
      setIsPublishing(false);
      return null;
    }
  };

  const getPublishedVersions = (projectId: string): PublishedVersion[] => {
    return getProjectPublished(projectId);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return {
    handleVercelPublish,
    isPublishing: isPublishing || publishStore,
    publishError: publishError || errorStore,
    getPublishedVersions,
    copyToClipboard,
  };
}
