import { ExpenseService } from '../services/expense.service.js';
import { getPool } from '../db/pool.js';

export class ExpenseController {
  static async getExpenses(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const result = await ExpenseService.listExpenses(db, req.user.id, req.query);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  static async getExpenseById(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const expense = await ExpenseService.getExpenseById(db, req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        data: expense
      });
    } catch (err) {
      next(err);
    }
  }

  static async createExpense(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const expense = await ExpenseService.createExpense(db, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: expense
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateExpense(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const expense = await ExpenseService.updateExpense(db, req.user.id, req.params.id, req.body);

      res.status(200).json({
        success: true,
        data: expense
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteExpense(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const result = await ExpenseService.deleteExpense(db, req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
