import apiClient from './api-client.js';

/**
 * Adapts incoming frontend filter options to exact backend query parameters.
 * Eliminates undefined, null, empty strings, and sentinel values ('ALL').
 *
 * @param {Object} [filters={}] - Filter options from UI or caller.
 * @returns {Object} Clean query parameters for GET /expenses.
 */
export function adaptExpenseFilters(filters = {}) {
  const params = {};

  if (filters.startDate && typeof filters.startDate === 'string' && filters.startDate.trim()) {
    params.startDate = filters.startDate.trim();
  }

  if (filters.endDate && typeof filters.endDate === 'string' && filters.endDate.trim()) {
    params.endDate = filters.endDate.trim();
  }

  // Support both camelCase and snake_case category UUID filter
  const categoryId = filters.categoryId || filters.category_id;
  if (categoryId && categoryId !== 'ALL' && typeof categoryId === 'string' && categoryId.trim()) {
    params.categoryId = categoryId.trim();
  }

  // Support payment method filter
  const paymentMethod = filters.paymentMethod || filters.payment_method;
  if (paymentMethod && paymentMethod !== 'ALL' && typeof paymentMethod === 'string' && paymentMethod.trim()) {
    params.paymentMethod = paymentMethod.trim();
  }

  // Search query in title or notes
  if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
    params.search = filters.search.trim();
  }

  // Sort by field and order
  if (filters.sortBy && typeof filters.sortBy === 'string') {
    params.sortBy = filters.sortBy.trim();
  }
  if (filters.sortOrder && typeof filters.sortOrder === 'string') {
    params.sortOrder = filters.sortOrder.trim().toLowerCase();
  }

  // Support composite sort parameter (e.g. 'date-desc', 'amount-asc')
  if (filters.sort && typeof filters.sort === 'string' && !params.sortBy) {
    const parts = filters.sort.trim().split('-');
    if (parts.length === 2) {
      params.sortBy = parts[0];
      params.sortOrder = parts[1].toLowerCase();
    }
  }

  // Pagination parameters
  if (filters.page !== undefined && filters.page !== null && filters.page !== '') {
    const pageNum = parseInt(filters.page, 10);
    if (!Number.isNaN(pageNum) && pageNum >= 1) {
      params.page = pageNum;
    }
  }

  if (filters.limit !== undefined && filters.limit !== null && filters.limit !== '') {
    const limitNum = parseInt(filters.limit, 10);
    if (!Number.isNaN(limitNum) && limitNum >= 1) {
      params.limit = limitNum;
    }
  }

  return params;
}

/**
 * Transforms frontend expense models or partial updates to backend-compliant payload.
 * Maps camelCase fields (paymentMethod, categoryId) to snake_case (payment_method, category_id).
 * Discards client-only fields (id, isDraft, UI category labels).
 *
 * @param {Object} data - Expense data or partial updates.
 * @returns {Object} Transformed payload matching server/src/services/expense.service.js.
 */
export function adaptExpenseToRequest(data = {}) {
  const payload = {};

  if ('title' in data && data.title !== undefined) {
    payload.title = typeof data.title === 'string' ? data.title.trim() : data.title;
  }

  if ('amount' in data && data.amount !== undefined && data.amount !== null && data.amount !== '') {
    const num = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      payload.amount = Number(num.toFixed(2));
    } else {
      payload.amount = data.amount;
    }
  }

  if ('date' in data && data.date !== undefined) {
    payload.date = typeof data.date === 'string' ? data.date.trim() : data.date;
  }

  // Payment method: paymentMethod -> payment_method
  const paymentMethod = 'payment_method' in data ? data.payment_method : data.paymentMethod;
  if (paymentMethod !== undefined) {
    payload.payment_method = typeof paymentMethod === 'string' ? paymentMethod.trim() : paymentMethod;
  }

  // Category UUID: categoryId -> category_id
  const categoryId = 'category_id' in data ? data.category_id : data.categoryId;
  if (categoryId !== undefined) {
    payload.category_id =
      categoryId && typeof categoryId === 'string' && categoryId.trim()
        ? categoryId.trim()
        : null;
  }

  if ('notes' in data && data.notes !== undefined) {
    payload.notes = typeof data.notes === 'string' ? data.notes.trim() : data.notes;
  }

  return payload;
}

/**
 * Normalizes a raw backend expense record into a predictable frontend representation.
 * Converts PostgreSQL string NUMERIC amount to a safe JavaScript number with 2 decimal precision.
 * Populates category display details from JOIN.
 *
 * @param {Object} row - Raw expense record from backend.
 * @returns {Object|null} Normalized expense entity.
 */
export function normalizeExpense(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  // PostgreSQL NUMERIC(12, 2) is returned as string by pg driver (e.g. "1450.50")
  const rawAmount = row.amount;
  let parsedAmount = 0;
  if (typeof rawAmount === 'number') {
    parsedAmount = rawAmount;
  } else if (typeof rawAmount === 'string' && rawAmount.trim().length > 0) {
    const parsed = parseFloat(rawAmount);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      parsedAmount = parsed;
    }
  }

  return {
    id: row.id,
    userId: row.user_id || null,
    categoryId: row.category_id || null,
    category_id: row.category_id || null,
    title: row.title || '',
    amount: Number(parsedAmount.toFixed(2)),
    date: row.date || '',
    paymentMethod: row.payment_method || 'UPI',
    payment_method: row.payment_method || 'UPI',
    notes: row.notes || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,

    // Category display fields from backend SQL JOIN
    category: row.category_name || 'Other',
    categoryName: row.category_name || 'Other',
    categoryIcon: row.category_icon || 'tag',
    categoryColor: row.category_color || '#6B7280'
  };
}

/**
 * Service for expense management operations.
 * Maps to RESTful backend endpoints in server/src/routes/expense.routes.js.
 */
export class ExpenseService {
  /**
   * Retrieves a paginated list of expenses matching the specified filter criteria.
   *
   * @param {Object} [filters={}] - Optional filtering, searching, sorting, and pagination options.
   * @returns {Promise<{items: Array<Object>, pagination: {total: number, page: number, limit: number, totalPages: number}}>}
   */
  static async listExpenses(filters = {}) {
    const queryParams = adaptExpenseFilters(filters);
    const response = await apiClient.get('/expenses', { params: queryParams });

    const rawItems = Array.isArray(response?.data) ? response.data : [];
    const items = rawItems.map(normalizeExpense).filter(Boolean);

    const pagination = response?.pagination || {
      total: items.length,
      page: 1,
      limit: items.length || 20,
      totalPages: 1
    };

    return {
      items,
      pagination: {
        total: Number(pagination.total) || 0,
        page: Number(pagination.page) || 1,
        limit: Number(pagination.limit) || 20,
        totalPages: Number(pagination.totalPages) || 1
      }
    };
  }

  /**
   * Retrieves a single expense record by its UUID.
   *
   * @param {string} id - Expense UUID.
   * @returns {Promise<Object>} Normalized expense record.
   */
  static async getExpenseById(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Expense ID is required.');
    }

    const response = await apiClient.get(`/expenses/${encodeURIComponent(id.trim())}`);
    return normalizeExpense(response?.data);
  }

  /**
   * Creates a new expense record.
   *
   * @param {Object} expenseData - Expense data.
   * @returns {Promise<Object>} Newly created and normalized expense record.
   */
  static async createExpense(expenseData) {
    const payload = adaptExpenseToRequest(expenseData);
    const response = await apiClient.post('/expenses', payload);
    return normalizeExpense(response?.data);
  }

  /**
   * Partially updates an existing expense record via HTTP PATCH.
   *
   * @param {string} id - Expense UUID.
   * @param {Object} updates - Fields to update.
   * @returns {Promise<Object>} Updated and normalized expense record.
   */
  static async updateExpense(id, updates) {
    if (!id || typeof id !== 'string') {
      throw new Error('Expense ID is required.');
    }

    const payload = adaptExpenseToRequest(updates);
    const response = await apiClient.patch(`/expenses/${encodeURIComponent(id.trim())}`, payload);
    return normalizeExpense(response?.data);
  }

  /**
   * Deletes an existing expense record by UUID.
   *
   * @param {string} id - Expense UUID.
   * @returns {Promise<{id: string, deleted: boolean}>} Deletion confirmation.
   */
  static async deleteExpense(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Expense ID is required.');
    }

    const response = await apiClient.delete(`/expenses/${encodeURIComponent(id.trim())}`);
    return response?.data || { id, deleted: true };
  }
}

export default ExpenseService;
