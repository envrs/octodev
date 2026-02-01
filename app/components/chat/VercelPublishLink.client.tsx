import { useStore } from '@nanostores/react';
import { vercelConnection } from '~/lib/stores/vercel';
import { lastPublished } from '~/lib/stores/vercel-publish';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

export function VercelPublishLink() {
  const connection = useStore(vercelConnection);
  const published = useStore(lastPublished);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (published?.shareableUrl) {
      setPublishedUrl(published.shareableUrl);
    }
  }, [published]);

  if (!publishedUrl) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-[#0070F3] z-50"
            onClick={(e) => {
              e.stopPropagation();
            }}
            title="Published version"
          >
            <div className="i-ph:share w-4 h-4" />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-50"
            sideOffset={5}
          >
            Published: {publishedUrl}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
