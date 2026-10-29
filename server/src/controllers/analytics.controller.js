import { AnalyticsService } from '../services/analytics.service.js';
import { getPool } from '../db/pool.js';

export class AnalyticsController {
  /**
   * Retrieves aggregated monthly analytics for the authenticated user.
   */
  static async getMonthlySummary(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const analytics = await AnalyticsService.getMonthlyAnalytics(db, req.user.id, req.query);

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (err) {
      next(err);
    }
  }
}
