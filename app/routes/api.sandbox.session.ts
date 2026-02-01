import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSandboxManager } from '~/lib/sandbox/sandbox-manager';
import type { SandboxConfig } from '~/types/sandbox';

const sandboxManager = getSandboxManager();

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (request.method === 'POST') {
      const body = await request.json();

      if (action === 'create') {
        const { config } = body as { config: SandboxConfig };

        if (!config) {
          return json({ error: 'Missing config' }, { status: 400 });
        }

        const session = sandboxManager.createSession(config);
        return json({
          success: true,
          session,
          message: 'Session created',
        });
      }

      if (action === 'approve') {
        const { sessionId, approvedBy } = body as { sessionId: string; approvedBy: string };

        if (!sessionId) {
          return json({ error: 'Missing sessionId' }, { status: 400 });
        }

        sandboxManager.approveExecution(sessionId, approvedBy || 'admin');
        return json({
          success: true,
          message: 'Execution approved',
        });
      }

      if (action === 'terminate') {
        const { sessionId } = body as { sessionId: string };

        if (!sessionId) {
          return json({ error: 'Missing sessionId' }, { status: 400 });
        }

        sandboxManager.terminateSession(sessionId);
        return json({
          success: true,
          message: 'Session terminated',
        });
      }

      if (action === 'rollback') {
        const { logId } = body as { logId: string };

        if (!logId) {
          return json({ error: 'Missing logId' }, { status: 400 });
        }

        await sandboxManager.rollbackExecution(logId);
        return json({
          success: true,
          message: 'Execution rolled back',
        });
      }

      return json({ error: 'Unknown action' }, { status: 400 });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('[Sandbox Session Error]:', error);
    return json({ error: String(error) }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  const action = url.searchParams.get('action');

  try {
    if (action === 'status') {
      const status = sandboxManager.getQueueStatus();
      return json({
        success: true,
        queueStatus: status,
      });
    }

    if (sessionId) {
      const session = sandboxManager.getSession(sessionId);

      if (!session) {
        return json({ error: 'Session not found' }, { status: 404 });
      }

      return json({
        success: true,
        session,
      });
    }

    return json({ error: 'Missing sessionId' }, { status: 400 });
  } catch (error) {
    console.error('[Sandbox Session Loader Error]:', error);
    return json({ error: String(error) }, { status: 500 });
  }
};
