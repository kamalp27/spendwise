import apiClient from './api-client.js';

/**
 * Normalizes a budget record from the backend response envelope for frontend consumption.
 * Preserves both camelCase and snake_case properties for full compatibility.
 *
 * @param {Object} raw - Raw budget object from backend.
 * @returns {Object|null} Normalized budget object.
 */
export function normalizeBudget(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const amount = Number(raw.amount || 0);
  const actualSpent = Number(
    raw.actual_spent !== undefined ? raw.actual_spent : (raw.actualSpent || 0)
  );
  const remainingAmount = Number(
    raw.remaining_amount !== undefined
      ? raw.remaining_amount
      : (raw.remainingAmount !== undefined ? raw.remainingAmount : (amount - actualSpent).toFixed(2))
  );
  const percentageUsed = Number(
    raw.percentage_used !== undefined
      ? raw.percentage_used
      : (raw.percentageUsed !== undefined
          ? raw.percentageUsed
          : (amount > 0 ? ((actualSpent / amount) * 100).toFixed(2) : 0))
  );

  const isOverall =
    raw.category_id === null ||
    raw.categoryId === null ||
    raw.is_overall === true ||
    raw.isOverall === true;

  const categoryId =
    raw.category_id !== undefined ? raw.category_id : (raw.categoryId || null);

  return {
    id: raw.id,
    user_id: raw.user_id || raw.userId || null,
    userId: raw.user_id || raw.userId || null,
    category_id: categoryId,
    categoryId: categoryId,
    amount,
    month: Number(raw.month),
    year: Number(raw.year),
    actual_spent: actualSpent,
    actualSpent,
    remaining_amount: remainingAmount,
    remainingAmount,
    percentage_used: percentageUsed,
    percentageUsed,
    is_overall: isOverall,
    isOverall,
    category_name: raw.category_name || raw.categoryName || null,
    categoryName: raw.category_name || raw.categoryName || null,
    category_icon: raw.category_icon || raw.categoryIcon || null,
    categoryIcon: raw.category_icon || raw.categoryIcon || null,
    category_color: raw.category_color || raw.categoryColor || null,
    categoryColor: raw.category_color || raw.categoryColor || null,
    created_at: raw.created_at || raw.createdAt || null,
    createdAt: raw.created_at || raw.createdAt || null,
    updated_at: raw.updated_at || raw.updatedAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null
  };
}

/**
 * Service for managing monthly budgets and comparing against actual spending.
 * Interacts with GET /api/v1/budgets and POST /api/v1/budgets.
 */
export class BudgetService {
  /**
   * Fetches budgets for a given month and year.
   *
   * @param {Object} params
   * @param {number|string} params.month - Calendar month (1-12).
   * @param {number|string} params.year - Calendar year (e.g. 2026).
   * @returns {Promise<Array<Object>>} Normalized budget list with spending metrics.
   */
  static async listBudgets({ month, year } = {}) {
    const params = {};
    if (month !== undefined && month !== null) params.month = month;
    if (year !== undefined && year !== null) params.year = year;

    const response = await apiClient.get('/budgets', { params });
    const items = Array.isArray(response?.data) ? response.data : [];
    return items.map(normalizeBudget).filter(Boolean);
  }

  /**
   * Creates a new monthly budget (overall or category-specific).
   *
   * @param {Object} budgetData
   * @param {string|null} [budgetData.categoryId] - Optional UUID of category (omitted/null for overall).
   * @param {string|null} [budgetData.category_id] - snake_case variant.
   * @param {number|string} budgetData.amount - Positive budget limit in INR.
   * @param {number|string} budgetData.month - Calendar month (1-12).
   * @param {number|string} budgetData.year - Calendar year (e.g. 2026).
   * @returns {Promise<Object>} Normalized created budget.
   */
  static async createBudget({ categoryId, category_id, amount, month, year } = {}) {
    const rawCatId = categoryId !== undefined ? categoryId : category_id;
    const payload = {
      category_id: rawCatId || null,
      amount: typeof amount === 'number' ? amount : parseFloat(amount),
      month: typeof month === 'number' ? month : parseInt(month, 10),
      year: typeof year === 'number' ? year : parseInt(year, 10)
    };

    const response = await apiClient.post('/budgets', payload);
    return normalizeBudget(response?.data);
  }
}

export default BudgetService;
