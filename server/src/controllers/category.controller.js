import { CategoryService } from '../services/category.service.js';
import { getPool } from '../db/pool.js';

export class CategoryController {
  static async getCategories(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const categories = await CategoryService.listCategories(db, req.user.id);

      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const category = await CategoryService.createCategory(db, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (err) {
      next(err);
    }
  }
}
