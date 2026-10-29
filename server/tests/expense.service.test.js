import { describe, it, expect, vi } from 'vitest';
import { ExpenseService } from '../src/services/expense.service.js';

describe('Expense Service', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const otherUserId = '99999999-9999-9999-9999-999999999999';
  const testCategoryId = '11111111-1111-1111-1111-111111111111';
  const testExpenseId = '22222222-2222-2222-2222-222222222222';

  describe('createExpense', () => {
    it('should create an expense with valid inputs and parameterized SQL', async () => {
      const mockCreated = {
        id: testExpenseId,
        user_id: testUserId,
        category_id: testCategoryId,
        title: 'Grocery Store',
        amount: '1540.50',
        date: '2026-10-28',
        payment_method: 'UPI',
        notes: 'Weekly groceries'
      };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          if (sql.includes('SELECT id, name, is_predefined')) {
            // Category verification query
            return { rows: [{ id: testCategoryId, is_predefined: true }] };
          }
          if (sql.includes('INSERT INTO expenses')) {
            expect(params).toEqual([
              testUserId,
              testCategoryId,
              'Grocery Store',
              1540.5,
              '2026-10-28',
              'UPI',
              'Weekly groceries'
            ]);
            return { rows: [mockCreated] };
          }
          return { rows: [] };
        })
      };

      const result = await ExpenseService.createExpense(mockDb, testUserId, {
        title: 'Grocery Store',
        amount: 1540.5,
        date: '2026-10-28',
        payment_method: 'UPI',
        category_id: testCategoryId,
        notes: 'Weekly groceries'
      });

      expect(result).toEqual(mockCreated);
    });

    it('should reject non-positive amounts', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        ExpenseService.createExpense(mockDb, testUserId, {
          title: 'Coffee',
          amount: -50,
          date: '2026-10-28'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'AMOUNT_NOT_POSITIVE'
      });
    });

    it('should reject invalid calendar dates', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        ExpenseService.createExpense(mockDb, testUserId, {
          title: 'Coffee',
          amount: 50,
          date: '2026-02-30' // February 30th does not exist
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_CALENDAR_DATE'
      });
    });

    it('should reject inaccessible categories owned by another user', async () => {
      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('SELECT id, name, is_predefined')) {
            return { rows: [] }; // Category not found for testUserId
          }
          return { rows: [] };
        })
      };

      await expect(
        ExpenseService.createExpense(mockDb, testUserId, {
          title: 'Sneakers',
          amount: 4500,
          date: '2026-10-28',
          category_id: testCategoryId
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_CATEGORY'
      });
    });
  });

  describe('getExpenseById', () => {
    it('should retrieve expense if owned by requesting user', async () => {
      const mockExpense = {
        id: testExpenseId,
        user_id: testUserId,
        title: 'Electricity Bill',
        amount: '2200.00'
      };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(params).toEqual([testExpenseId, testUserId]);
          return { rows: [mockExpense] };
        })
      };

      const result = await ExpenseService.getExpenseById(mockDb, testUserId, testExpenseId);
      expect(result).toEqual(mockExpense);
    });

    it('should throw 404 without leaking existence if owned by another user', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      await expect(
        ExpenseService.getExpenseById(mockDb, testUserId, testExpenseId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'EXPENSE_NOT_FOUND'
      });
    });
  });

  describe('listExpenses', () => {
    it('should support pagination, date filtering, and search keyword', async () => {
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          if (sql.includes('COUNT(*)')) {
            return { rows: [{ total: '35' }] };
          }
          expect(sql).toContain('e.date >= $2');
          expect(sql).toContain('e.date <= $3');
          expect(sql).toContain('(e.title ILIKE $4 OR e.notes ILIKE $4)');
          expect(params).toContain('2026-10-01');
          expect(params).toContain('2026-10-31');
          expect(params).toContain('%coffee%');
          return { rows: [{ id: testExpenseId, title: 'Coffee Shop' }] };
        })
      };

      const result = await ExpenseService.listExpenses(mockDb, testUserId, {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        search: 'coffee',
        page: 2,
        limit: 10
      });

      expect(result.pagination).toEqual({
        total: 35,
        page: 2,
        limit: 10,
        totalPages: 4
      });
      expect(result.items.length).toBe(1);
    });

    it('should reject invalid date ranges when startDate > endDate', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        ExpenseService.listExpenses(mockDb, testUserId, {
          startDate: '2026-10-31',
          endDate: '2026-10-01'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DATE_RANGE'
      });
    });

    it('should reject disallowed sortBy fields', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        ExpenseService.listExpenses(mockDb, testUserId, {
          sortBy: 'malicious_column_injection'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SORT_FIELD'
      });
    });
  });

  describe('updateExpense & deleteExpense', () => {
    it('should partially update an expense if owned by user', async () => {
      const mockExisting = { id: testExpenseId, user_id: testUserId };
      const mockUpdated = { id: testExpenseId, title: 'Updated Title', amount: '350.00' };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          if (sql.includes('WHERE e.id = $1 AND e.user_id = $2')) {
            return { rows: [mockExisting] };
          }
          if (sql.includes('UPDATE expenses')) {
            expect(params).toContain('Updated Title');
            return { rows: [mockUpdated] };
          }
          return { rows: [] };
        })
      };

      const result = await ExpenseService.updateExpense(mockDb, testUserId, testExpenseId, {
        title: 'Updated Title'
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should delete an expense and enforce user ownership', async () => {
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(params).toEqual([testExpenseId, testUserId]);
          return { rows: [{ id: testExpenseId }] };
        })
      };

      const result = await ExpenseService.deleteExpense(mockDb, testUserId, testExpenseId);
      expect(result).toEqual({ id: testExpenseId, deleted: true });
    });

    it('should throw 404 when deleting an expense that does not exist or belongs to another user', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      await expect(
        ExpenseService.deleteExpense(mockDb, testUserId, testExpenseId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'EXPENSE_NOT_FOUND'
      });
    });
  });
});
