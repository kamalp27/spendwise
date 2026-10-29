import { BudgetService } from '../services/budget.service.js';
import { getPool } from '../db/pool.js';

export class BudgetController {
  static async getBudgets(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const budgets = await BudgetService.listBudgetsWithSpending(db, req.user.id, req.query);

      res.status(200).json({
        success: true,
        data: budgets
      });
    } catch (err) {
      next(err);
    }
  }

  static async createBudget(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const budget = await BudgetService.createBudget(db, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: budget
      });
    } catch (err) {
      next(err);
    }
  }
}
