import { isDatabaseConfigured, getPool } from '../db/pool.js';

export class HealthController {
  /**
   * GET /api/v1/health
   * Reports application process health and probes database connectivity when configured.
   *
   * Response behavior:
   * - Unconfigured database: HTTP 200 { status: 'ok', service: 'spendwise-api', database: 'unconfigured' }
   * - Configured & connected: HTTP 200 { status: 'ok', service: 'spendwise-api', database: 'connected' }
   * - Configured & failed probe: HTTP 503 { status: 'degraded', service: 'spendwise-api', database: 'disconnected', error: 'Database connectivity check failed' }
   */
  static async getHealth(req, res) {
    const hasDb = Boolean(req.app?.locals?.db) || isDatabaseConfigured();

    if (!hasDb) {
      return res.status(200).json({
        status: 'ok',
        service: 'spendwise-api',
        database: 'unconfigured'
      });
    }

    try {
      const db = req.app?.locals?.db || getPool();
      await db.query('SELECT 1');

      return res.status(200).json({
        status: 'ok',
        service: 'spendwise-api',
        database: 'connected'
      });
    } catch (err) {
      // Log diagnostic message internally without leaking credentials or database internals to client
      console.error('[SpendWise API] Health check database probe failed:', err.message);

      return res.status(503).json({
        status: 'degraded',
        service: 'spendwise-api',
        database: 'disconnected',
        error: 'Database connectivity check failed'
      });
    }
  }
}
