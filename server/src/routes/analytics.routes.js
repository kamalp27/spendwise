import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = Router();

router.get('/analytics/summary', AnalyticsController.getMonthlySummary);

export default router;
