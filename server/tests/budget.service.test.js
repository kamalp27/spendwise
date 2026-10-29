import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetService } from '../src/services/budget.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { BudgetController } from '../src/controllers/budget.controller.js';

describe('Budget Service & Controller (Stage 5.6A)', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const otherUserId = '00000000-0000-0000-0000-000000000002';
  const validCategoryId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Budget Creation (createBudget)', () => {
    it('should create an overall budget when categoryId is null or omitted', async () => {
      const mockCreated = {
        id: '22222222-2222-2222-2222-222222222222',
        user_id: testUserId,
        category_id: null,
        amount: '15000.00',
        month: 10,
        year: 2026,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('INSERT INTO budgets');
          expect(params).toEqual([testUserId, null, 15000, 10, 2026]);
          return { rows: [mockCreated] };
        })
      };

      const result = await BudgetService.createBudget(mockDb, testUserId, {
        amount: 15000,
        month: 10,
        year: 2026
      });

      expect(result.id).toBe(mockCreated.id);
      expect(result.amount).toBe(15000);
      expect(result.is_overall).toBe(true);
      expect(result.isOverall).toBe(true);
      expect(result.categoryId).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should create a category-specific budget after verifying category access', async () => {
      const mockCategory = {
        id: validCategoryId,
        name: 'Groceries',
        icon: 'utensils',
        color: '#EF4444',
        is_predefined: true,
        user_id: null
      };

      vi.spyOn(CategoryService, 'verifyCategoryAccess').mockResolvedValue(mockCategory);

      const mockCreated = {
        id: '33333333-3333-3333-3333-333333333333',
        user_id: testUserId,
        category_id: validCategoryId,
        amount: '5000.00',
        month: 10,
        year: 2026,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('INSERT INTO budgets');
          expect(params).toEqual([testUserId, validCategoryId, 5000, 10, 2026]);
          return { rows: [mockCreated] };
        })
      };

      const result = await BudgetService.createBudget(mockDb, testUserId, {
        categoryId: validCategoryId,
        amount: 5000,
        month: 10,
        year: 2026
      });

      expect(CategoryService.verifyCategoryAccess).toHaveBeenCalledWith(mockDb, validCategoryId, testUserId);
      expect(result.categoryId).toBe(validCategoryId);
      expect(result.categoryName).toBe('Groceries');
      expect(result.categoryIcon).toBe('utensils');
      expect(result.categoryColor).toBe('#EF4444');
      expect(result.isOverall).toBe(false);
      expect(result.amount).toBe(5000);
    });

    it('should reject invalid, zero, or negative amounts', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 0, month: 10, year: 2026 })
      ).rejects.toThrow(/must be greater than zero/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: -500, month: 10, year: 2026 })
      ).rejects.toThrow(/must be greater than zero/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 'abc', month: 10, year: 2026 })
      ).rejects.toThrow(/must be a valid number/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 100.555, month: 10, year: 2026 })
      ).rejects.toThrow(/cannot have more than 2 decimal places/);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should reject invalid months (out of 1-12 range) and invalid years (out of 2024-2100)', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 1000, month: 0, year: 2026 })
      ).rejects.toThrow(/must be an integer between 1 and 12/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 1000, month: 13, year: 2026 })
      ).rejects.toThrow(/must be an integer between 1 and 12/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 1000, month: 10, year: 2023 })
      ).rejects.toThrow(/must be an integer between 2024 and 2100/);

      await expect(
        BudgetService.createBudget(mockDb, testUserId, { amount: 1000, month: 10, year: 2101 })
      ).rejects.toThrow(/must be an integer between 2024 and 2100/);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should reject when category does not exist or belongs to another user', async () => {
      const mockDb = { query: vi.fn() };
      vi.spyOn(CategoryService, 'verifyCategoryAccess').mockRejectedValue(
        new Error('The specified category does not exist or you do not have permission to use it.')
      );

      await expect(
        BudgetService.createBudget(mockDb, testUserId, {
          categoryId: validCategoryId,
          amount: 2500,
          month: 10,
          year: 2026
        })
      ).rejects.toThrow(/does not exist or you do not have permission/);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return 409 Conflict when unique overall budget constraint is violated (code 23505)', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint idx_budgets_user_overall');
      duplicateError.code = '23505';

      const mockDb = {
        query: vi.fn(async () => {
          throw duplicateError;
        })
      };

      await expect(
        BudgetService.createBudget(mockDb, testUserId, {
          amount: 20000,
          month: 10,
          year: 2026
        })
      ).rejects.toThrow(/An overall monthly budget for 10\/2026 already exists/);
    });

    it('should return 409 Conflict when unique category budget constraint is violated (code 23505)', async () => {
      vi.spyOn(CategoryService, 'verifyCategoryAccess').mockResolvedValue({
        id: validCategoryId,
        name: 'Dining',
        icon: 'utensils',
        color: '#EF4444'
      });

      const duplicateError = new Error('duplicate key value violates unique constraint idx_budgets_user_category');
      duplicateError.code = '23505';

      const mockDb = {
        query: vi.fn(async () => {
          throw duplicateError;
        })
      };

      await expect(
        BudgetService.createBudget(mockDb, testUserId, {
          categoryId: validCategoryId,
          amount: 4000,
          month: 10,
          year: 2026
        })
      ).rejects.toThrow(/A budget for "Dining" for 10\/2026 already exists/);
    });
  });

  describe('Budget Listing & Aggregated Spending (listBudgetsWithSpending)', () => {
    it('queries budgets strictly for the requesting user and selected period', async () => {
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3');
          expect(params).toEqual([
            testUserId,
            10,
            2026,
            '2026-10-01',
            '2026-11-01'
          ]);
          return { rows: [] };
        })
      };

      const result = await BudgetService.listBudgetsWithSpending(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('calculates month boundaries properly for December rollover', async () => {
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(params[3]).toBe('2026-12-01');
          expect(params[4]).toBe('2027-01-01'); // Rollover to next year
          return { rows: [] };
        })
      };

      await BudgetService.listBudgetsWithSpending(mockDb, testUserId, {
        month: 12,
        year: 2026
      });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('returns structured calculations for overall and category budgets', async () => {
      const mockRows = [
        {
          id: 'overall-budget-id',
          user_id: testUserId,
          category_id: null,
          amount: '20000.00',
          month: 10,
          year: 2026,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category_name: null,
          category_icon: null,
          category_color: null,
          actual_spent: '7500.50'
        },
        {
          id: 'category-budget-id',
          user_id: testUserId,
          category_id: validCategoryId,
          amount: '5000.00',
          month: 10,
          year: 2026,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category_name: 'Food & Dining',
          category_icon: 'utensils',
          category_color: '#EF4444',
          actual_spent: '4500.00'
        }
      ];

      const mockDb = {
        query: vi.fn(async () => ({ rows: mockRows }))
      };

      const budgets = await BudgetService.listBudgetsWithSpending(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(budgets.length).toBe(2);

      // Verify Overall Budget Calculations
      const overall = budgets[0];
      expect(overall.isOverall).toBe(true);
      expect(overall.amount).toBe(20000);
      expect(overall.actualSpent).toBe(7500.5);
      expect(overall.remainingAmount).toBe(12499.5);
      expect(overall.percentageUsed).toBe(37.5);
      expect(overall.categoryName).toBeNull();

      // Verify Category Budget Calculations
      const catBudget = budgets[1];
      expect(catBudget.isOverall).toBe(false);
      expect(catBudget.amount).toBe(5000);
      expect(catBudget.actualSpent).toBe(4500);
      expect(catBudget.remainingAmount).toBe(500);
      expect(catBudget.percentageUsed).toBe(90);
      expect(catBudget.categoryName).toBe('Food & Dining');
      expect(catBudget.categoryIcon).toBe('utensils');
      expect(catBudget.categoryColor).toBe('#EF4444');
    });

    it('handles zero actual spending when no expenses exist without crashing or producing NaN', async () => {
      const mockRows = [
        {
          id: 'budget-zero-expenses',
          user_id: testUserId,
          category_id: null,
          amount: '10000.00',
          month: 10,
          year: 2026,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category_name: null,
          category_icon: null,
          category_color: null,
          actual_spent: '0'
        }
      ];

      const mockDb = {
        query: vi.fn(async () => ({ rows: mockRows }))
      };

      const [budget] = await BudgetService.listBudgetsWithSpending(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(budget.amount).toBe(10000);
      expect(budget.actualSpent).toBe(0);
      expect(budget.remainingAmount).toBe(10000);
      expect(budget.percentageUsed).toBe(0);
      expect(Number.isNaN(budget.percentageUsed)).toBe(false);
    });

    it('requires month and year parameters', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        BudgetService.listBudgetsWithSpending(mockDb, testUserId, { year: 2026 })
      ).rejects.toThrow(/month is required/);

      await expect(
        BudgetService.listBudgetsWithSpending(mockDb, testUserId, { month: 10 })
      ).rejects.toThrow(/year is required/);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('Budget Controller Integration', () => {
    it('getBudgets returns standard 200 response envelope', async () => {
      const mockReq = {
        user: { id: testUserId },
        query: { month: '10', year: '2026' },
        app: { locals: { db: {} } }
      };

      const mockJson = vi.fn();
      const mockStatus = vi.fn(() => ({ json: mockJson }));
      const mockRes = { status: mockStatus };
      const mockNext = vi.fn();

      vi.spyOn(BudgetService, 'listBudgetsWithSpending').mockResolvedValue([
        { id: 'b-1', amount: 10000, month: 10, year: 2026, actualSpent: 2000 }
      ]);

      await BudgetController.getBudgets(mockReq, mockRes, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: [expect.objectContaining({ id: 'b-1', amount: 10000 })]
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('createBudget returns standard 201 response envelope', async () => {
      const mockReq = {
        user: { id: testUserId },
        body: { amount: 10000, month: 10, year: 2026 },
        app: { locals: { db: {} } }
      };

      const mockJson = vi.fn();
      const mockStatus = vi.fn(() => ({ json: mockJson }));
      const mockRes = { status: mockStatus };
      const mockNext = vi.fn();

      vi.spyOn(BudgetService, 'createBudget').mockResolvedValue({
        id: 'b-created',
        amount: 10000,
        month: 10,
        year: 2026,
        isOverall: true
      });

      await BudgetController.createBudget(mockReq, mockRes, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 'b-created', amount: 10000 })
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('forwards operational errors to error handler next()', async () => {
      const mockReq = {
        user: { id: testUserId },
        body: { amount: -500 },
        app: { locals: { db: {} } }
      };

      const mockNext = vi.fn();
      const mockRes = { status: vi.fn() };

      const validationErr = new Error('amount must be greater than zero.');
      vi.spyOn(BudgetService, 'createBudget').mockRejectedValue(validationErr);

      await BudgetController.createBudget(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationErr);
    });
  });
});
