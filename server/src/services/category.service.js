import { AppError } from '../utils/app-error.js';
import { validateString, validateHexColor } from '../utils/validation.js';

/**
 * Category Service
 * Handles business logic, input sanitization, and database queries for categories.
 */
export class CategoryService {
  /**
   * Retrieves all global predefined categories plus the requesting user's custom categories.
   */
  static async listCategories(db, userId) {
    const query = `
      SELECT id, name, icon, color, is_predefined, user_id, created_at, updated_at
      FROM categories
      WHERE is_predefined = TRUE OR user_id = $1
      ORDER BY is_predefined DESC, name ASC;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows;
  }

  /**
   * Creates a new user-scoped custom category.
   * Enforces that user categories are never global and always belong to the requesting user.
   */
  static async createCategory(db, userId, { name, icon, color }) {
    const cleanName = validateString(name, { min: 1, max: 50, required: true, fieldName: 'name' });
    const cleanIcon = validateString(icon, { min: 1, max: 50, required: false, fieldName: 'icon' }) || 'tag';
    const cleanColor = validateHexColor(color, 'color');

    const query = `
      INSERT INTO categories (name, icon, color, is_predefined, user_id)
      VALUES ($1, $2, $3, FALSE, $4)
      RETURNING id, name, icon, color, is_predefined, user_id, created_at, updated_at;
    `;

    try {
      const { rows } = await db.query(query, [cleanName, cleanIcon, cleanColor, userId]);
      return rows[0];
    } catch (err) {
      // PostgreSQL unique constraint violation code (23505)
      if (err.code === '23505') {
        throw AppError.conflict(
          `A category named "${cleanName}" already exists in your account or as a standard category.`,
          'CATEGORY_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  }

  /**
   * Verifies that a given category exists and is accessible to the specified user
   * (either globally predefined or owned by this user).
   */
  static async verifyCategoryAccess(db, categoryId, userId) {
    if (!categoryId) return null;

    const query = `
      SELECT id, name, is_predefined, user_id
      FROM categories
      WHERE id = $1 AND (is_predefined = TRUE OR user_id = $2);
    `;
    const { rows } = await db.query(query, [categoryId, userId]);

    if (rows.length === 0) {
      throw AppError.badRequest(
        'The specified category does not exist or you do not have permission to use it.',
        'INVALID_CATEGORY'
      );
    }

    return rows[0];
  }
}
