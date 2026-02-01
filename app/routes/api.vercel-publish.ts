import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface PublishRequestBody {
  projectId: string;
  customLabel?: string;
  isPrivate?: boolean;
  token: string;
}

/**
 * Generate a version timestamp for publishing
 * Format: YYYY-MM-DD-HHMM (e.g., 2026-02-01-1405)
 */
const generateVersionTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}`;
};

/**
 * Create a shareable alias for a published version
 * Format: project-name-v-timestamp (max 63 chars for Vercel)
 */
const generateAlias = (projectName: string, timestamp: string): string => {
  const baseAlias = `${projectName}-v-${timestamp}`;
  // Vercel aliases must be lowercase and max 63 characters
  return baseAlias.toLowerCase().substring(0, 63);
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { projectId, customLabel, isPrivate, token } = (await request.json()) as PublishRequestBody;

    if (!token) {
      return json({ error: 'Not connected to Vercel' }, { status: 401 });
    }

    if (!projectId) {
      return json({ error: 'projectId is required' }, { status: 400 });
    }

    console.log('[v0] Publishing project:', projectId);

    // Step 1: Get project info
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!projectResponse.ok) {
      const errorData = (await projectResponse.json()) as any;
      return json(
        { error: `Failed to fetch project: ${errorData.error?.message || 'Unknown error'}` },
        { status: 400 },
      );
    }

    const projectData = (await projectResponse.json()) as any;
    const projectName = projectData.name;

    console.log('[v0] Got project info:', projectName);

    // Step 2: Get latest production deployment
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!deploymentsResponse.ok) {
      const errorData = (await deploymentsResponse.json()) as any;
      return json(
        { error: `Failed to fetch deployments: ${errorData.error?.message || 'Unknown error'}` },
        { status: 400 },
      );
    }

    const deploymentsData = (await deploymentsResponse.json()) as any;
    const latestDeployment = deploymentsData.deployments?.[0];

    if (!latestDeployment) {
      return json({ error: 'No deployment found for this project' }, { status: 404 });
    }

    console.log('[v0] Got latest deployment:', latestDeployment.id);

    // Step 3: Generate version info
    const versionTimestamp = generateVersionTimestamp();
    const customVersionLabel = customLabel || versionTimestamp;
    const alias = generateAlias(projectName, versionTimestamp);

    console.log('[v0] Generated version - timestamp:', versionTimestamp, 'label:', customVersionLabel, 'alias:', alias);

    // Step 4: Create alias for this deployment
    const aliasResponse = await fetch(`https://api.vercel.com/v4/deployments/${latestDeployment.id}/aliases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alias: alias,
      }),
    });

    if (!aliasResponse.ok) {
      const errorData = (await aliasResponse.json()) as any;
      console.error('[v0] Failed to create alias:', errorData);
      return json(
        { error: `Failed to create alias: ${errorData.error?.message || 'Unknown error'}` },
        { status: 400 },
      );
    }

    const aliasData = (await aliasResponse.json()) as any;

    console.log('[v0] Created alias:', aliasData);

    // Step 5: Get target/production info for metadata
    const targetsResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/target/production`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let targetInfo: any = null;
    if (targetsResponse.ok) {
      targetInfo = (await targetsResponse.json()) as any;
    }

    // Step 6: Build response with shareable link
    const shareableUrl = `https://${alias}.vercel.app`;
    const publishedAt = new Date().toISOString();

    return json({
      success: true,
      published: {
        projectId,
        projectName,
        deploymentId: latestDeployment.id,
        versionLabel: customVersionLabel,
        versionTimestamp,
        alias,
        shareableUrl,
        publishedAt,
        isPrivate: isPrivate || false,
        deploymentUrl: latestDeployment.url ? `https://${latestDeployment.url}` : undefined,
      },
    });
  } catch (error) {
    console.error('[v0] Publish error:', error);
    return json(
      {
        error: 'Publish failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
