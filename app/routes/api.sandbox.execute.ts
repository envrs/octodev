import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSandboxManager } from '~/lib/sandbox/sandbox-manager';
import { getExecutionLogger } from '~/lib/sandbox/execution-logger';
import type { SandboxConfig, ExecutionType } from '~/types/sandbox';

const sandboxManager = getSandboxManager();
const executionLogger = getExecutionLogger();

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { sessionId, config, code, priority } = body as {
      sessionId: string;
      config: SandboxConfig;
      code: string;
      priority?: 'high' | 'normal' | 'low';
    };

    if (!sessionId || !code || !config) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create log stream for real-time output
    const stream = executionLogger.createStream(config.id);

    // Queue execution
    const executionPromise = sandboxManager.executeCode(sessionId, config, code, priority || 'normal');

    // Return immediately with execution ID
    return json({
      success: true,
      executionId: stream.id,
      message: 'Execution queued',
      queueStatus: sandboxManager.getQueueStatus(),
    });
  } catch (error) {
    console.error('[Sandbox Execute Error]:', error);
    return json({ error: String(error) }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ error: 'Use POST to execute code' }, { status: 405 });
};
