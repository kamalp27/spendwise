import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetService, normalizeBudget } from '../src/services/budget.service.js';
import apiClient from '../src/services/api-client.js';

describe('Budget Service (Client)', () => {
  const mockCategoryBudgetRaw = {
    id: 'budget-uuid-1',
    user_id: 'user-uuid-1',
    category_id: 'cat-uuid-1',
    amount: '4000.00',
    month: 10,
    year: 2026,
    actual_spent: 1000,
    remaining_amount: 3000,
    percentage_used: 25,
    is_overall: false,
    category_name: 'Dining',
    category_icon: 'utensils',
    category_color: '#EF4444',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z'
  };

  const mockOverallBudgetRaw = {
    id: 'budget-uuid-overall',
    user_id: 'user-uuid-1',
    category_id: null,
    amount: '20000.00',
    month: 10,
    year: 2026,
    actual_spent: 5000,
    remaining_amount: 15000,
    percentage_used: 25,
    is_overall: true,
    category_name: null,
    category_icon: null,
    category_color: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeBudget', () => {
    it('normalizes category budget with both camelCase and snake_case properties', () => {
      const normalized = normalizeBudget(mockCategoryBudgetRaw);

      expect(normalized.id).toBe('budget-uuid-1');
      expect(normalized.amount).toBe(4000);
      expect(normalized.actualSpent).toBe(1000);
      expect(normalized.remainingAmount).toBe(3000);
      expect(normalized.percentageUsed).toBe(25);
      expect(normalized.isOverall).toBe(false);
      expect(normalized.categoryId).toBe('cat-uuid-1');
      expect(normalized.categoryName).toBe('Dining');
      expect(normalized.categoryIcon).toBe('utensils');
      expect(normalized.categoryColor).toBe('#EF4444');
    });

    it('normalizes overall budget correctly identifying isOverall as true', () => {
      const normalized = normalizeBudget(mockOverallBudgetRaw);

      expect(normalized.id).toBe('budget-uuid-overall');
      expect(normalized.amount).toBe(20000);
      expect(normalized.isOverall).toBe(true);
      expect(normalized.is_overall).toBe(true);
      expect(normalized.categoryId).toBeNull();
      expect(normalized.categoryName).toBeNull();
    });

    it('calculates remaining and percentage used if backend omits calculated fields', () => {
      const minimalRaw = {
        id: 'min-1',
        amount: 1000,
        actual_spent: 250,
        category_id: null,
        month: 10,
        year: 2026
      };

      const normalized = normalizeBudget(minimalRaw);
      expect(normalized.remainingAmount).toBe(750);
      expect(normalized.percentageUsed).toBe(25);
    });

    it('returns null for falsy inputs', () => {
      expect(normalizeBudget(null)).toBeNull();
      expect(normalizeBudget(undefined)).toBeNull();
      expect(normalizeBudget('')).toBeNull();
    });
  });

  describe('listBudgets', () => {
    it('sends GET /budgets with month and year query parameters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: [mockOverallBudgetRaw, mockCategoryBudgetRaw]
      });

      const result = await BudgetService.listBudgets({ month: 10, year: 2026 });

      expect(getSpy).toHaveBeenCalledWith('/budgets', {
        params: { month: 10, year: 2026 }
      });
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('budget-uuid-overall');
      expect(result[1].id).toBe('budget-uuid-1');
    });

    it('handles empty results safely', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: []
      });

      const result = await BudgetService.listBudgets({ month: 10, year: 2026 });
      expect(result).toEqual([]);
    });
  });

  describe('createBudget', () => {
    it('sends POST /budgets with category_id null for overall budget', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: mockOverallBudgetRaw
      });

      const result = await BudgetService.createBudget({
        amount: 20000,
        month: 10,
        year: 2026
      });

      expect(postSpy).toHaveBeenCalledWith('/budgets', {
        category_id: null,
        amount: 20000,
        month: 10,
        year: 2026
      });
      expect(result.id).toBe('budget-uuid-overall');
      expect(result.isOverall).toBe(true);
    });

    it('sends POST /budgets with category_id for category budget', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: mockCategoryBudgetRaw
      });

      const result = await BudgetService.createBudget({
        categoryId: 'cat-uuid-1',
        amount: 4000,
        month: '10',
        year: '2026'
      });

      expect(postSpy).toHaveBeenCalledWith('/budgets', {
        category_id: 'cat-uuid-1',
        amount: 4000,
        month: 10,
        year: 2026
      });
      expect(result.categoryId).toBe('cat-uuid-1');
      expect(result.amount).toBe(4000);
    });

    it('propagates API client errors directly when budget creation fails', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(
        new Error('An overall monthly budget for 10/2026 already exists in your account.')
      );

      await expect(
        BudgetService.createBudget({
          amount: 20000,
          month: 10,
          year: 2026
        })
      ).rejects.toThrow(/An overall monthly budget for 10\/2026 already exists/);
    });
  });
});
