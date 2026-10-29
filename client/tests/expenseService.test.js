import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../src/services/api-client.js';
import {
  ExpenseService,
  adaptExpenseFilters,
  adaptExpenseToRequest,
  normalizeExpense
} from '../src/services/expense.service.js';

describe('ExpenseService and Data Adapters', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  describe('adaptExpenseFilters unit tests', () => {
    it('serializes valid filters and preserves exact backend query parameter names', () => {
      const filters = {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        categoryId: 'e5792455-8888-4444-9999-123456789abc',
        paymentMethod: 'UPI',
        search: 'Grocery store',
        sortBy: 'amount',
        sortOrder: 'desc',
        page: 2,
        limit: 25
      };

      const params = adaptExpenseFilters(filters);

      expect(params).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        categoryId: 'e5792455-8888-4444-9999-123456789abc',
        paymentMethod: 'UPI',
        search: 'Grocery store',
        sortBy: 'amount',
        sortOrder: 'desc',
        page: 2,
        limit: 25
      });
    });

    it('ignores "ALL", empty strings, null, and undefined values', () => {
      const filters = {
        categoryId: 'ALL',
        paymentMethod: 'ALL',
        search: '   ',
        startDate: '',
        endDate: null,
        sortBy: undefined
      };

      const params = adaptExpenseFilters(filters);
      expect(params).toEqual({});
    });

    it('decomposes composite sort string (e.g. date-desc)', () => {
      const params = adaptExpenseFilters({ sort: 'amount-asc' });
      expect(params.sortBy).toBe('amount');
      expect(params.sortOrder).toBe('asc');
    });

    it('sanitizes and preserves pagination numbers', () => {
      const params = adaptExpenseFilters({ page: '3', limit: '50' });
      expect(params.page).toBe(3);
      expect(params.limit).toBe(50);
    });
  });

  describe('adaptExpenseToRequest unit tests', () => {
    it('converts camelCase fields to snake_case and strips UI-only fields', () => {
      const uiExpense = {
        id: 'draft-1730123456',
        title: ' Lunch with Client ',
        amount: '450.758',
        date: '2026-10-25',
        paymentMethod: 'Credit Card',
        categoryId: 'c1234567-0000-4000-8000-000000000001',
        notes: ' Project discussion remarks ',
        isDraft: true,
        category: 'Food & Dining',
        categoryColor: '#EF4444'
      };

      const requestPayload = adaptExpenseToRequest(uiExpense);

      expect(requestPayload).toEqual({
        title: 'Lunch with Client',
        amount: 450.76,
        date: '2026-10-25',
        payment_method: 'Credit Card',
        category_id: 'c1234567-0000-4000-8000-000000000001',
        notes: 'Project discussion remarks'
      });

      // Confirm UI fields were stripped
      expect(requestPayload.id).toBeUndefined();
      expect(requestPayload.isDraft).toBeUndefined();
      expect(requestPayload.category).toBeUndefined();
      expect(requestPayload.categoryColor).toBeUndefined();
    });

    it('supports partial updates for PATCH operations', () => {
      const partialUpdate = {
        amount: 1250,
        notes: 'Updated invoice reference'
      };

      const payload = adaptExpenseToRequest(partialUpdate);
      expect(payload).toEqual({
        amount: 1250.0,
        notes: 'Updated invoice reference'
      });
      expect(payload.title).toBeUndefined();
      expect(payload.date).toBeUndefined();
    });

    it('sets category_id to null when explicitly cleared', () => {
      const payload = adaptExpenseToRequest({ categoryId: '' });
      expect(payload.category_id).toBeNull();
    });
  });

  describe('normalizeExpense unit tests', () => {
    it('converts PostgreSQL NUMERIC string amount to number and populates category fields', () => {
      const rawBackendRow = {
        id: 'exp-uuid-1',
        user_id: 'user-uuid-1',
        category_id: 'cat-uuid-1',
        title: 'Team Dinner',
        amount: '2450.50',
        date: '2026-10-26',
        payment_method: 'UPI',
        notes: 'Quarterly celebration',
        created_at: '2026-10-26T19:30:00Z',
        updated_at: '2026-10-26T19:30:00Z',
        category_name: 'Food & Dining',
        category_icon: 'utensils',
        category_color: '#EF4444'
      };

      const normalized = normalizeExpense(rawBackendRow);

      expect(normalized).toEqual({
        id: 'exp-uuid-1',
        userId: 'user-uuid-1',
        categoryId: 'cat-uuid-1',
        category_id: 'cat-uuid-1',
        title: 'Team Dinner',
        amount: 2450.5,
        date: '2026-10-26',
        paymentMethod: 'UPI',
        payment_method: 'UPI',
        notes: 'Quarterly celebration',
        createdAt: '2026-10-26T19:30:00Z',
        updatedAt: '2026-10-26T19:30:00Z',
        category: 'Food & Dining',
        categoryName: 'Food & Dining',
        categoryIcon: 'utensils',
        categoryColor: '#EF4444'
      });
      expect(typeof normalized.amount).toBe('number');
    });

    it('returns null for invalid inputs', () => {
      expect(normalizeExpense(null)).toBeNull();
      expect(normalizeExpense(undefined)).toBeNull();
      expect(normalizeExpense('string')).toBeNull();
    });
  });

  describe('ExpenseService.listExpenses', () => {
    it('calls GET /expenses with mapped query params and preserves pagination metadata', async () => {
      let capturedConfig = null;

      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: [
              {
                id: 'exp-1',
                title: 'Electricity Bill',
                amount: '1850.00',
                date: '2026-10-20',
                payment_method: 'Net Banking',
                category_id: 'cat-util',
                category_name: 'Bills & Utilities',
                category_icon: 'receipt',
                category_color: '#10B981'
              }
            ],
            pagination: {
              total: 45,
              page: 2,
              limit: 20,
              totalPages: 3
            }
          }
        };
      };

      const result = await ExpenseService.listExpenses({
        page: 2,
        limit: 20,
        paymentMethod: 'Net Banking'
      });

      expect(capturedConfig.url).toBe('/expenses');
      expect(capturedConfig.method).toBe('get');
      expect(capturedConfig.params).toEqual({
        page: 2,
        limit: 20,
        paymentMethod: 'Net Banking'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('exp-1');
      expect(result.items[0].amount).toBe(1850.0);
      expect(result.items[0].category).toBe('Bills & Utilities');

      expect(result.pagination).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3
      });
    });

    it('does not swallow errors into empty results', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Bad Request');
        error.response = {
          status: 400,
          data: { success: false, error: { code: 'INVALID_DATE_RANGE', message: 'startDate > endDate' } }
        };
        throw error;
      };

      await expect(
        ExpenseService.listExpenses({ startDate: '2026-10-30', endDate: '2026-10-01' })
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_DATE_RANGE'
      });
    });
  });

  describe('ExpenseService.getExpenseById', () => {
    it('calls GET /expenses/:id and returns normalized expense', async () => {
      let capturedUrl = null;

      apiClient.defaults.adapter = async (config) => {
        capturedUrl = config.url;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'exp-uuid-99',
              title: 'Mobile Recharge',
              amount: '299.00',
              date: '2026-10-27',
              payment_method: 'UPI'
            }
          }
        };
      };

      const expense = await ExpenseService.getExpenseById('exp-uuid-99');
      expect(capturedUrl).toBe('/expenses/exp-uuid-99');
      expect(expense.id).toBe('exp-uuid-99');
      expect(expense.amount).toBe(299);
    });

    it('propagates 404 when expense does not exist', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Not Found');
        error.response = {
          status: 404,
          data: { success: false, error: { code: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' } }
        };
        throw error;
      };

      await expect(ExpenseService.getExpenseById('non-existent-id')).rejects.toMatchObject({
        status: 404,
        code: 'EXPENSE_NOT_FOUND'
      });
    });
  });

  describe('ExpenseService.createExpense', () => {
    it('calls POST /expenses with snake_case payload and returns normalized result', async () => {
      let capturedConfig = null;

      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'new-expense-uuid',
              title: 'Book Purchase',
              amount: '750.00',
              date: '2026-10-28',
              payment_method: 'Debit Card',
              category_id: 'cat-edu-uuid'
            }
          }
        };
      };

      const result = await ExpenseService.createExpense({
        title: 'Book Purchase',
        amount: 750,
        date: '2026-10-28',
        paymentMethod: 'Debit Card',
        categoryId: 'cat-edu-uuid'
      });

      expect(capturedConfig.url).toBe('/expenses');
      expect(capturedConfig.method).toBe('post');
      expect(JSON.parse(capturedConfig.data)).toEqual({
        title: 'Book Purchase',
        amount: 750,
        date: '2026-10-28',
        payment_method: 'Debit Card',
        category_id: 'cat-edu-uuid'
      });

      expect(result.id).toBe('new-expense-uuid');
      expect(result.amount).toBe(750);
      expect(result.paymentMethod).toBe('Debit Card');
    });
  });

  describe('ExpenseService.updateExpense', () => {
    it('calls PATCH /expenses/:id with partial payload and returns normalized result', async () => {
      let capturedConfig = null;

      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'exp-uuid-1',
              title: 'Book Purchase (Hardcover)',
              amount: '950.00',
              date: '2026-10-28',
              payment_method: 'Debit Card',
              category_id: 'cat-edu-uuid'
            }
          }
        };
      };

      const result = await ExpenseService.updateExpense('exp-uuid-1', {
        title: 'Book Purchase (Hardcover)',
        amount: 950
      });

      expect(capturedConfig.url).toBe('/expenses/exp-uuid-1');
      expect(capturedConfig.method).toBe('patch');
      expect(JSON.parse(capturedConfig.data)).toEqual({
        title: 'Book Purchase (Hardcover)',
        amount: 950
      });

      expect(result.amount).toBe(950);
      expect(result.title).toBe('Book Purchase (Hardcover)');
    });
  });

  describe('ExpenseService.deleteExpense', () => {
    it('calls DELETE /expenses/:id and returns confirmation payload', async () => {
      let capturedConfig = null;

      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'exp-uuid-1',
              deleted: true
            }
          }
        };
      };

      const result = await ExpenseService.deleteExpense('exp-uuid-1');

      expect(capturedConfig.url).toBe('/expenses/exp-uuid-1');
      expect(capturedConfig.method).toBe('delete');
      expect(result).toEqual({ id: 'exp-uuid-1', deleted: true });
    });
  });
});
