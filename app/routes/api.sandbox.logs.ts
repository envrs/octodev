import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getExecutionLogger } from '~/lib/sandbox/execution-logger';

const executionLogger = getExecutionLogger();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const logId = url.searchParams.get('logId');
  const sessionId = url.searchParams.get('sessionId');
  const type = url.searchParams.get('type') || 'json'; // json or csv
  const status = url.searchParams.get('status');
  const action = url.searchParams.get('action');

  try {
    // Export format handling
    if (action === 'export') {
      if (type === 'csv') {
        const csv = executionLogger.exportLogsCSV(sessionId || undefined);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="sandbox-logs-${Date.now()}.csv"`,
          },
        });
      } else {
        const json_data = executionLogger.exportLogs(sessionId || undefined);
        return new Response(json_data, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="sandbox-logs-${Date.now()}.json"`,
          },
        });
      }
    }

    // Get specific log
    if (logId) {
      const log = executionLogger.getLog(logId);
      if (!log) {
        return json({ error: 'Log not found' }, { status: 404 });
      }

      return json({ success: true, log });
    }

    // Get logs by session
    if (sessionId) {
      const logs = executionLogger.getLogsBySession(sessionId);
      return json({ success: true, logs, count: logs.length });
    }

    // Get logs by status
    if (status) {
      const logs = executionLogger.getLogsByStatus(status as any);
      return json({ success: true, logs, count: logs.length });
    }

    // Get all logs with stats
    const allLogs = executionLogger.getAllLogs();
    const stats = executionLogger.getStatistics();

    return json({
      success: true,
      logs: allLogs,
      count: allLogs.length,
      stats,
    });
  } catch (error) {
    console.error('[Sandbox Logs Error]:', error);
    return json({ error: String(error) }, { status: 500 });
  }
};
