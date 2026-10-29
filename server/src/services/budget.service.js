import { AppError } from '../utils/app-error.js';
import {
  validateUUID,
  validateAmount,
  validateMonth,
  validateYear
} from '../utils/validation.js';
import { CategoryService } from './category.service.js';

export class BudgetService {
  /**
   * Lists budgets for the specified user and period (month, year),
   * aggregating actual spending from user's expense records for that month.
   */
  static async listBudgetsWithSpending(db, userId, { month, year } = {}) {
    validateUUID(userId, 'userId');
    const cleanMonth = validateMonth(month, 'month');
    const cleanYear = validateYear(year, 'year');

    // Calculate month boundary strings (YYYY-MM-DD) for sargable expense date range
    const startDate = `${cleanYear}-${String(cleanMonth).padStart(2, '0')}-01`;
    const nextMonth = cleanMonth === 12 ? 1 : cleanMonth + 1;
    const nextYear = cleanMonth === 12 ? cleanYear + 1 : cleanYear;
    const nextMonthStartDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const query = `
      SELECT
        b.id,
        b.user_id,
        b.category_id,
        b.amount,
        b.month,
        b.year,
        b.created_at,
        b.updated_at,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color,
        COALESCE(
          CASE
            WHEN b.category_id IS NULL THEN (
              SELECT SUM(e.amount)
              FROM expenses e
              WHERE e.user_id = b.user_id
                AND e.date >= $4 AND e.date < $5
            )
            ELSE (
              SELECT SUM(e.amount)
              FROM expenses e
              WHERE e.user_id = b.user_id
                AND e.category_id = b.category_id
                AND e.date >= $4 AND e.date < $5
            )
          END,
          0
        ) AS actual_spent
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
      ORDER BY (b.category_id IS NOT NULL) ASC, c.name ASC;
    `;

    const params = [userId, cleanMonth, cleanYear, startDate, nextMonthStartDate];
    const { rows } = await db.query(query, params);

    return rows.map((row) => {
      const limit = parseFloat(row.amount);
      const actualSpent = parseFloat(row.actual_spent || 0);
      const remaining = parseFloat((limit - actualSpent).toFixed(2));
      const percentageUsed = limit > 0 ? parseFloat(((actualSpent / limit) * 100).toFixed(2)) : 0;
      const isOverall = row.category_id === null;

      return {
        id: row.id,
        user_id: row.user_id,
        userId: row.user_id,
        category_id: row.category_id,
        categoryId: row.category_id,
        amount: limit,
        month: Number(row.month),
        year: Number(row.year),
        actual_spent: actualSpent,
        actualSpent: actualSpent,
        remaining_amount: remaining,
        remainingAmount: remaining,
        percentage_used: percentageUsed,
        percentageUsed: percentageUsed,
        is_overall: isOverall,
        isOverall: isOverall,
        category_name: row.category_name || null,
        categoryName: row.category_name || null,
        category_icon: row.category_icon || null,
        categoryIcon: row.category_icon || null,
        category_color: row.category_color || null,
        categoryColor: row.category_color || null,
        created_at: row.created_at,
        createdAt: row.created_at,
        updated_at: row.updated_at,
        updatedAt: row.updated_at
      };
    });
  }

  /**
   * Creates an overall budget (category_id is null) or category-specific budget.
   * Enforces that category is verified, amount is positive, month/year are valid,
   * and partial unique constraints (code 23505) are caught as conflict errors.
   */
  static async createBudget(db, userId, { categoryId, category_id, amount, month, year } = {}) {
    validateUUID(userId, 'userId');
    const cleanAmount = validateAmount(amount, 'amount');
    const cleanMonth = validateMonth(month, 'month');
    const cleanYear = validateYear(year, 'year');

    const rawCatId = categoryId !== undefined ? categoryId : category_id;
    let cleanCategoryId = null;
    let categoryMeta = null;

    if (rawCatId !== undefined && rawCatId !== null && rawCatId !== '') {
      validateUUID(rawCatId, 'category_id');
      categoryMeta = await CategoryService.verifyCategoryAccess(db, rawCatId, userId);
      cleanCategoryId = rawCatId;
    }

    const query = `
      INSERT INTO budgets (
        user_id,
        category_id,
        amount,
        month,
        year
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        category_id,
        amount,
        month,
        year,
        created_at,
        updated_at;
    `;

    const params = [userId, cleanCategoryId, cleanAmount, cleanMonth, cleanYear];

    try {
      const { rows } = await db.query(query, params);
      const created = rows[0];
      const limit = parseFloat(created.amount);

      return {
        id: created.id,
        user_id: created.user_id,
        userId: created.user_id,
        category_id: created.category_id,
        categoryId: created.category_id,
        amount: limit,
        month: Number(created.month),
        year: Number(created.year),
        is_overall: created.category_id === null,
        isOverall: created.category_id === null,
        category_name: categoryMeta?.name || null,
        categoryName: categoryMeta?.name || null,
        category_icon: categoryMeta?.icon || null,
        categoryIcon: categoryMeta?.icon || null,
        category_color: categoryMeta?.color || null,
        categoryColor: categoryMeta?.color || null,
        created_at: created.created_at,
        createdAt: created.created_at,
        updated_at: created.updated_at,
        updatedAt: created.updated_at
      };
    } catch (err) {
      // PostgreSQL unique constraint violation code (23505)
      if (err.code === '23505') {
        if (!cleanCategoryId) {
          throw AppError.conflict(
            `An overall monthly budget for ${cleanMonth}/${cleanYear} already exists in your account.`,
            'BUDGET_ALREADY_EXISTS'
          );
        } else {
          const catName = categoryMeta?.name ? `"${categoryMeta.name}"` : 'this category';
          throw AppError.conflict(
            `A budget for ${catName} for ${cleanMonth}/${cleanYear} already exists in your account.`,
            'BUDGET_ALREADY_EXISTS'
          );
        }
      }
      throw err;
    }
  }
}
