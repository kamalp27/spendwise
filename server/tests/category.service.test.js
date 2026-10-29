import { describe, it, expect, vi } from 'vitest';
import { CategoryService } from '../src/services/category.service.js';

describe('Category Service', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';

  describe('listCategories', () => {
    it('should query categories with parameterized query including global and user categories', async () => {
      const mockRows = [
        { id: '1', name: 'Food & Dining', is_predefined: true, user_id: null },
        { id: '2', name: 'Freelance Tools', is_predefined: false, user_id: testUserId }
      ];

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('is_predefined = TRUE OR user_id = $1');
          expect(params).toEqual([testUserId]);
          return { rows: mockRows };
        })
      };

      const result = await CategoryService.listCategories(mockDb, testUserId);
      expect(result).toEqual(mockRows);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCategory', () => {
    it('should create a user category with is_predefined = FALSE and user_id = userId', async () => {
      const mockCreated = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Books',
        icon: 'book',
        color: '#10B981',
        is_predefined: false,
        user_id: testUserId
      };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('INSERT INTO categories');
          expect(sql).toContain('FALSE');
          expect(params).toEqual(['Books', 'book', '#10B981', testUserId]);
          return { rows: [mockCreated] };
        })
      };

      const result = await CategoryService.createCategory(mockDb, testUserId, {
        name: '  Books  ',
        icon: 'book',
        color: '#10B981'
      });

      expect(result).toEqual(mockCreated);
    });

    it('should return 409 Conflict when unique category constraint is violated (code 23505)', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.code = '23505';

      const mockDb = {
        query: vi.fn(async () => {
          throw duplicateError;
        })
      };

      await expect(
        CategoryService.createCategory(mockDb, testUserId, {
          name: 'Food & Dining',
          icon: 'utensils',
          color: '#EF4444'
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CATEGORY_ALREADY_EXISTS'
      });
    });
  });

  describe('verifyCategoryAccess', () => {
    it('should verify category exists and belongs to user or is global', async () => {
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(params).toEqual([categoryId, testUserId]);
          return { rows: [{ id: categoryId, is_predefined: true }] };
        })
      };

      const category = await CategoryService.verifyCategoryAccess(mockDb, categoryId, testUserId);
      expect(category).toBeDefined();
      expect(category.id).toBe(categoryId);
    });

    it('should reject when category does not exist or belongs to another user', async () => {
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      await expect(
        CategoryService.verifyCategoryAccess(mockDb, categoryId, testUserId)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_CATEGORY'
      });
    });
  });
});
