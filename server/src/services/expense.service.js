import { AppError } from '../utils/app-error.js';
import {
  validateUUID,
  validateDate,
  validateAmount,
  validatePaymentMethod,
  validateString,
  ALLOWED_EXPENSE_SORT_FIELDS,
  ALLOWED_SORT_ORDERS
} from '../utils/validation.js';
import { CategoryService } from './category.service.js';

export class ExpenseService {
  /**
   * Lists expenses for the specified user with filtering, searching, sorting, and pagination.
   */
  static async listExpenses(db, userId, queryParams = {}) {
    const {
      startDate,
      endDate,
      categoryId,
      paymentMethod,
      search,
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = queryParams;

    // 1. Validate & Normalize Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // 2. Validate Sorting
    if (!ALLOWED_EXPENSE_SORT_FIELDS.includes(sortBy)) {
      throw AppError.badRequest(
        `Invalid sortBy field "${sortBy}". Allowed fields: ${ALLOWED_EXPENSE_SORT_FIELDS.join(', ')}.`,
        'INVALID_SORT_FIELD'
      );
    }
    const normalizedOrder = String(sortOrder).toLowerCase();
    if (!ALLOWED_SORT_ORDERS.includes(normalizedOrder)) {
      throw AppError.badRequest(
        `Invalid sortOrder "${sortOrder}". Allowed values: ${ALLOWED_SORT_ORDERS.join(', ')}.`,
        'INVALID_SORT_ORDER'
      );
    }

    // 3. Build Parameterized Dynamic Filters
    const conditions = ['e.user_id = $1'];
    const params = [userId];
    let pIdx = 1;

    if (startDate) {
      validateDate(startDate, 'startDate');
      pIdx++;
      conditions.push(`e.date >= $${pIdx}`);
      params.push(startDate);
    }

    if (endDate) {
      validateDate(endDate, 'endDate');
      pIdx++;
      conditions.push(`e.date <= $${pIdx}`);
      params.push(endDate);
    }

    if (startDate && endDate && startDate > endDate) {
      throw AppError.badRequest('startDate cannot be after endDate.', 'INVALID_DATE_RANGE');
    }

    if (categoryId) {
      validateUUID(categoryId, 'categoryId');
      pIdx++;
      conditions.push(`e.category_id = $${pIdx}`);
      params.push(categoryId);
    }

    if (paymentMethod) {
      validatePaymentMethod(paymentMethod, 'paymentMethod');
      pIdx++;
      conditions.push(`e.payment_method = $${pIdx}`);
      params.push(paymentMethod);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      pIdx++;
      // Search in title and notes without SQL injection
      conditions.push(`(e.title ILIKE $${pIdx} OR e.notes ILIKE $${pIdx})`);
      params.push(`%${search.trim()}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 4. Query Total Matching Records for Pagination Metadata
    const countSql = `SELECT COUNT(*) AS total FROM expenses e ${whereClause};`;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || 0, 10);
    const totalPages = Math.ceil(total / limitNum) || 1;

    // 5. Query Paginated Records
    const dataParams = [...params];
    const limitIdx = ++pIdx;
    const offsetIdx = ++pIdx;
    dataParams.push(limitNum, offset);

    // Secure sort field insertion from strict whitelist
    const orderSql = `ORDER BY e.${sortBy} ${normalizedOrder.toUpperCase()}, e.id ASC`;

    const dataSql = `
      SELECT
        e.id,
        e.user_id,
        e.category_id,
        e.title,
        e.amount,
        TO_CHAR(e.date, 'YYYY-MM-DD') AS date,
        e.payment_method,
        e.notes,
        e.created_at,
        e.updated_at,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      ${whereClause}
      ${orderSql}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const { rows } = await db.query(dataSql, dataParams);

    return {
      items: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    };
  }

  /**
   * Retrieves a single expense record by ID, strictly enforcing user ownership.
   */
  static async getExpenseById(db, userId, id) {
    validateUUID(id, 'id');

    const query = `
      SELECT
        e.id,
        e.user_id,
        e.category_id,
        e.title,
        e.amount,
        TO_CHAR(e.date, 'YYYY-MM-DD') AS date,
        e.payment_method,
        e.notes,
        e.created_at,
        e.updated_at,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.id = $1 AND e.user_id = $2;
    `;

    const { rows } = await db.query(query, [id, userId]);

    if (rows.length === 0) {
      throw AppError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
    }

    return rows[0];
  }

  /**
   * Creates a new expense record with category validation and strict user ownership.
   */
  static async createExpense(db, userId, data) {
    const { title, amount, date, payment_method, category_id, notes } = data;

    const cleanTitle = validateString(title, { min: 1, max: 150, required: true, fieldName: 'title' });
    const cleanAmount = validateAmount(amount, 'amount');
    const cleanDate = validateDate(date, 'date');
    const cleanPaymentMethod = validatePaymentMethod(payment_method, 'payment_method');
    const cleanNotes = validateString(notes, { min: 0, max: 1000, required: false, fieldName: 'notes' });

    let cleanCategoryId = null;
    if (category_id) {
      validateUUID(category_id, 'category_id');
      await CategoryService.verifyCategoryAccess(db, category_id, userId);
      cleanCategoryId = category_id;
    }

    const query = `
      INSERT INTO expenses (
        user_id,
        category_id,
        title,
        amount,
        date,
        payment_method,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id,
        category_id,
        title,
        amount,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        payment_method,
        notes,
        created_at,
        updated_at;
    `;

    const params = [
      userId,
      cleanCategoryId,
      cleanTitle,
      cleanAmount,
      cleanDate,
      cleanPaymentMethod,
      cleanNotes
    ];

    const { rows } = await db.query(query, params);
    return rows[0];
  }

  /**
   * Partially updates an existing expense record, verifying ownership and category access.
   */
  static async updateExpense(db, userId, id, updates) {
    validateUUID(id, 'id');

    if (!updates || Object.keys(updates).length === 0) {
      throw AppError.badRequest('No update fields provided.', 'EMPTY_UPDATE_PAYLOAD');
    }

    // Verify expense exists and is owned by user
    await this.getExpenseById(db, userId, id);

    const setClauses = [];
    const params = [id, userId];
    let pIdx = 2;

    if ('title' in updates) {
      const cleanTitle = validateString(updates.title, { min: 1, max: 150, required: true, fieldName: 'title' });
      pIdx++;
      setClauses.push(`title = $${pIdx}`);
      params.push(cleanTitle);
    }

    if ('amount' in updates) {
      const cleanAmount = validateAmount(updates.amount, 'amount');
      pIdx++;
      setClauses.push(`amount = $${pIdx}`);
      params.push(cleanAmount);
    }

    if ('date' in updates) {
      const cleanDate = validateDate(updates.date, 'date');
      pIdx++;
      setClauses.push(`date = $${pIdx}`);
      params.push(cleanDate);
    }

    if ('payment_method' in updates) {
      const cleanPaymentMethod = validatePaymentMethod(updates.payment_method, 'payment_method');
      pIdx++;
      setClauses.push(`payment_method = $${pIdx}`);
      params.push(cleanPaymentMethod);
    }

    if ('category_id' in updates) {
      let cleanCategoryId = null;
      if (updates.category_id) {
        validateUUID(updates.category_id, 'category_id');
        await CategoryService.verifyCategoryAccess(db, updates.category_id, userId);
        cleanCategoryId = updates.category_id;
      }
      pIdx++;
      setClauses.push(`category_id = $${pIdx}`);
      params.push(cleanCategoryId);
    }

    if ('notes' in updates) {
      const cleanNotes = validateString(updates.notes, { min: 0, max: 1000, required: false, fieldName: 'notes' });
      pIdx++;
      setClauses.push(`notes = $${pIdx}`);
      params.push(cleanNotes);
    }

    if (setClauses.length === 0) {
      throw AppError.badRequest('No valid fields provided to update.', 'NO_VALID_FIELDS');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    const updateSql = `
      UPDATE expenses
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING
        id,
        user_id,
        category_id,
        title,
        amount,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        payment_method,
        notes,
        created_at,
        updated_at;
    `;

    const { rows } = await db.query(updateSql, params);
    return rows[0];
  }

  /**
   * Deletes an expense record, strictly verifying user ownership.
   */
  static async deleteExpense(db, userId, id) {
    validateUUID(id, 'id');

    const query = `
      DELETE FROM expenses
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;

    const { rows } = await db.query(query, [id, userId]);

    if (rows.length === 0) {
      throw AppError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
    }

    return { id: rows[0].id, deleted: true };
  }
}
