import apiClient from './api-client.js';

/**
 * Normalizes a category record from the backend response envelope for frontend consumption.
 * Preserves the database UUID, snake_case compatibility, and provides camelCase aliases.
 *
 * @param {Object} cat - Raw category record from backend.
 * @returns {Object|null} Normalized category object.
 */
export function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'object') {
    return null;
  }

  return {
    id: cat.id,
    name: cat.name,
    icon: cat.icon || 'tag',
    color: cat.color || '#3B82F6',
    isPredefined: Boolean(cat.is_predefined),
    is_predefined: Boolean(cat.is_predefined),
    userId: cat.user_id || null,
    createdAt: cat.created_at || null,
    updatedAt: cat.updated_at || null
  };
}

/**
 * Service for category management.
 * Strictly adheres to backend endpoints: GET /categories and POST /categories.
 */
export class CategoryService {
  /**
   * Fetches all global predefined categories plus custom user categories.
   *
   * @returns {Promise<Array<Object>>} List of normalized categories.
   */
  static async getCategories() {
    const response = await apiClient.get('/categories');
    const categories = Array.isArray(response?.data) ? response.data : [];
    return categories.map(normalizeCategory).filter(Boolean);
  }

  /**
   * Creates a new user-scoped custom category.
   *
   * @param {Object} categoryData
   * @param {string} categoryData.name - Required category name (1-50 chars).
   * @param {string} [categoryData.icon] - Icon name string (defaults to 'tag').
   * @param {string} [categoryData.color] - 6-digit hex color code (defaults to '#3B82F6').
   * @returns {Promise<Object>} The newly created and normalized category.
   */
  static async createCategory({ name, icon = 'tag', color = '#3B82F6' }) {
    const payload = {
      name: typeof name === 'string' ? name.trim() : name,
      icon: typeof icon === 'string' ? icon.trim() : 'tag',
      color: typeof color === 'string' ? color.trim().toUpperCase() : '#3B82F6'
    };

    const response = await apiClient.post('/categories', payload);
    return normalizeCategory(response?.data);
  }
}

export default CategoryService;
