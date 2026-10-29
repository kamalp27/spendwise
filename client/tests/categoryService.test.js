import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../src/services/api-client.js';
import { CategoryService, normalizeCategory } from '../src/services/category.service.js';

describe('CategoryService & normalizeCategory', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  describe('normalizeCategory unit tests', () => {
    it('returns null for falsy or invalid inputs', () => {
      expect(normalizeCategory(null)).toBeNull();
      expect(normalizeCategory(undefined)).toBeNull();
      expect(normalizeCategory('invalid')).toBeNull();
    });

    it('normalizes raw category row from backend', () => {
      const raw = {
        id: 'c1234567-0000-4000-8000-000000000001',
        name: 'Dining & Takeout',
        icon: 'utensils',
        color: '#EF4444',
        is_predefined: true,
        user_id: null,
        created_at: '2026-10-25T12:00:00Z',
        updated_at: '2026-10-25T12:00:00Z'
      };

      const normalized = normalizeCategory(raw);

      expect(normalized).toEqual({
        id: 'c1234567-0000-4000-8000-000000000001',
        name: 'Dining & Takeout',
        icon: 'utensils',
        color: '#EF4444',
        isPredefined: true,
        is_predefined: true,
        userId: null,
        createdAt: '2026-10-25T12:00:00Z',
        updatedAt: '2026-10-25T12:00:00Z'
      });
    });

    it('supplies defaults when optional fields are missing', () => {
      const raw = {
        id: 'cat-custom-1',
        name: 'Freelance Tools'
      };

      const normalized = normalizeCategory(raw);
      expect(normalized.icon).toBe('tag');
      expect(normalized.color).toBe('#3B82F6');
      expect(normalized.isPredefined).toBe(false);
      expect(normalized.userId).toBeNull();
    });
  });

  describe('CategoryService.getCategories', () => {
    it('calls GET /categories and normalizes the response list', async () => {
      let requestedUrl = null;
      let requestedMethod = null;

      apiClient.defaults.adapter = async (config) => {
        requestedUrl = config.url;
        requestedMethod = config.method;

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: [
              {
                id: 'cat-uuid-1',
                name: 'Groceries',
                icon: 'shopping-bag',
                color: '#10B981',
                is_predefined: true,
                user_id: null
              },
              {
                id: 'cat-uuid-2',
                name: 'Gym & Fitness',
                icon: 'dumbbell',
                color: '#3B82F6',
                is_predefined: false,
                user_id: 'user-uuid-1'
              }
            ]
          }
        };
      };

      const categories = await CategoryService.getCategories();

      expect(requestedUrl).toBe('/categories');
      expect(requestedMethod).toBe('get');
      expect(categories).toHaveLength(2);

      expect(categories[0]).toEqual({
        id: 'cat-uuid-1',
        name: 'Groceries',
        icon: 'shopping-bag',
        color: '#10B981',
        isPredefined: true,
        is_predefined: true,
        userId: null,
        createdAt: null,
        updatedAt: null
      });

      expect(categories[1]).toEqual({
        id: 'cat-uuid-2',
        name: 'Gym & Fitness',
        icon: 'dumbbell',
        color: '#3B82F6',
        isPredefined: false,
        is_predefined: false,
        userId: 'user-uuid-1',
        createdAt: null,
        updatedAt: null
      });
    });

    it('handles empty category list gracefully', async () => {
      apiClient.defaults.adapter = async (config) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: { success: true, data: [] }
      });

      const categories = await CategoryService.getCategories();
      expect(categories).toEqual([]);
    });

    it('propagates server errors without converting to empty results', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Server error');
        error.response = {
          status: 500,
          data: { success: false, error: { code: 'DATABASE_ERROR', message: 'DB down' } }
        };
        throw error;
      };

      await expect(CategoryService.getCategories()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('CategoryService.createCategory', () => {
    it('calls POST /categories with formatted payload and returns normalized result', async () => {
      let requestCaptured = null;

      apiClient.defaults.adapter = async (config) => {
        requestCaptured = {
          url: config.url,
          method: config.method,
          data: JSON.parse(config.data)
        };

        return {
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'new-cat-uuid',
              name: 'Pet Care',
              icon: 'paw',
              color: '#F59E0B',
              is_predefined: false,
              user_id: 'user-uuid-1',
              created_at: '2026-10-28T12:00:00Z'
            }
          }
        };
      };

      const result = await CategoryService.createCategory({
        name: '  Pet Care  ',
        icon: 'paw',
        color: '#f59e0b'
      });

      expect(requestCaptured.url).toBe('/categories');
      expect(requestCaptured.method).toBe('post');
      expect(requestCaptured.data).toEqual({
        name: 'Pet Care',
        icon: 'paw',
        color: '#F59E0B'
      });

      expect(result.id).toBe('new-cat-uuid');
      expect(result.name).toBe('Pet Care');
      expect(result.icon).toBe('paw');
      expect(result.color).toBe('#F59E0B');
      expect(result.isPredefined).toBe(false);
      expect(result.userId).toBe('user-uuid-1');
    });

    it('propagates 409 Conflict when category already exists', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Conflict');
        error.response = {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'CATEGORY_ALREADY_EXISTS',
              message: 'A category named "Pet Care" already exists.'
            }
          }
        };
        throw error;
      };

      await expect(CategoryService.createCategory({ name: 'Pet Care' })).rejects.toMatchObject({
        status: 409,
        code: 'CATEGORY_ALREADY_EXISTS',
        message: 'A category named "Pet Care" already exists.'
      });
    });
  });
});
