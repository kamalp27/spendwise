import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService, normalizeAnalyticsSummary } from '../src/services/analytics.service.js';
import apiClient from '../src/services/api-client.js';

describe('Analytics Service (Client)', () => {
  const mockRawPayload = {
    period: { month: 10, year: 2026 },
    summary: {
      totalSpending: 42150.75,
      totalTransactions: 35,
      averageExpense: 1204.31,
      highestExpense: 6500.0,
      previousMonthSpending: 38000.0,
      monthOverMonthChange: 4150.75,
      monthOverMonthPercentage: 10.92
    },
    byCategory: [
      {
        categoryId: 'cat-uuid-1',
        categoryName: 'Food & Dining',
        categoryIcon: 'utensils',
        categoryColor: '#F59E0B',
        totalAmount: 15200.0,
        transactionCount: 15,
        percentage: 36.06
      },
      {
        categoryId: null,
        categoryName: 'Uncategorized',
        categoryIcon: 'tag',
        categoryColor: '#6B7280',
        totalAmount: 2500.0,
        transactionCount: 2,
        percentage: 5.93
      }
    ],
    byPaymentMethod: [
      {
        paymentMethod: 'UPI',
        totalAmount: 26000.0,
        transactionCount: 22,
        percentage: 61.68
      },
      {
        paymentMethod: 'Credit Card',
        totalAmount: 16150.75,
        transactionCount: 13,
        percentage: 38.32
      }
    ],
    dailyTrend: [
      { date: '2026-10-02', dailyTotal: 1500.0, transactionCount: 2 },
      { date: '2026-10-14', dailyTotal: 4200.0, transactionCount: 3 }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeAnalyticsSummary', () => {
    it('normalizes complete camelCase analytics payload correctly', () => {
      const normalized = normalizeAnalyticsSummary(mockRawPayload);

      expect(normalized.period).toEqual({ month: 10, year: 2026 });
      expect(normalized.summary.totalSpending).toBe(42150.75);
      expect(normalized.summary.totalTransactions).toBe(35);
      expect(normalized.summary.averageExpense).toBe(1204.31);
      expect(normalized.summary.highestExpense).toBe(6500);
      expect(normalized.summary.previousMonthSpending).toBe(38000);
      expect(normalized.summary.monthOverMonthChange).toBe(4150.75);
      expect(normalized.summary.monthOverMonthPercentage).toBe(10.92);

      expect(normalized.byCategory).toHaveLength(2);
      expect(normalized.byCategory[0]).toEqual({
        categoryId: 'cat-uuid-1',
        categoryName: 'Food & Dining',
        categoryIcon: 'utensils',
        categoryColor: '#F59E0B',
        totalAmount: 15200,
        transactionCount: 15,
        percentage: 36.06
      });
      expect(normalized.byCategory[1].categoryId).toBeNull();
      expect(normalized.byCategory[1].categoryName).toBe('Uncategorized');

      expect(normalized.byPaymentMethod).toHaveLength(2);
      expect(normalized.byPaymentMethod[0]).toEqual({
        paymentMethod: 'UPI',
        totalAmount: 26000,
        transactionCount: 22,
        percentage: 61.68
      });

      expect(normalized.dailyTrend).toHaveLength(2);
      expect(normalized.dailyTrend[0]).toEqual({
        date: '2026-10-02',
        dailyTotal: 1500,
        transactionCount: 2
      });
    });

    it('normalizes snake_case variants from backend response', () => {
      const snakeRaw = {
        period: { month: 11, year: 2026 },
        summary: {
          total_spending: 20000,
          total_transactions: 10,
          average_expense: 2000,
          highest_expense: 5000,
          previous_month_spending: 0,
          month_over_month_change: 20000,
          month_over_month_percentage: null
        },
        by_category: [
          {
            category_id: 'cat-2',
            category_name: 'Transport',
            category_icon: 'car',
            category_color: '#3B82F6',
            total_amount: 5000,
            transaction_count: 4,
            percentage: 25
          }
        ],
        by_payment_method: [
          {
            payment_method: 'Cash',
            total_amount: 5000,
            transaction_count: 2,
            percentage: 25
          }
        ],
        daily_trend: [
          {
            date: '2026-11-05',
            daily_total: 2500,
            transaction_count: 1
          }
        ]
      };

      const normalized = normalizeAnalyticsSummary(snakeRaw);

      expect(normalized.period).toEqual({ month: 11, year: 2026 });
      expect(normalized.summary.totalSpending).toBe(20000);
      expect(normalized.summary.monthOverMonthPercentage).toBeNull();
      expect(normalized.byCategory[0].categoryId).toBe('cat-2');
      expect(normalized.byCategory[0].categoryName).toBe('Transport');
      expect(normalized.byPaymentMethod[0].paymentMethod).toBe('Cash');
      expect(normalized.dailyTrend[0].dailyTotal).toBe(2500);
    });

    it('safely handles empty or malformed inputs without throwing', () => {
      const normalizedNull = normalizeAnalyticsSummary(null);
      expect(normalizedNull.summary.totalSpending).toBe(0);
      expect(normalizedNull.summary.monthOverMonthPercentage).toBeNull();
      expect(normalizedNull.byCategory).toEqual([]);
      expect(normalizedNull.byPaymentMethod).toEqual([]);
      expect(normalizedNull.dailyTrend).toEqual([]);

      const normalizedEmpty = normalizeAnalyticsSummary({});
      expect(normalizedEmpty.summary.totalSpending).toBe(0);
      expect(normalizedEmpty.summary.totalTransactions).toBe(0);
      expect(normalizedEmpty.summary.monthOverMonthPercentage).toBeNull();
      expect(normalizedEmpty.byCategory).toEqual([]);
    });

    it('preserves null for monthOverMonthPercentage when mathematically undefined', () => {
      const payload = {
        summary: {
          totalSpending: 10000,
          previousMonthSpending: 0,
          monthOverMonthPercentage: null
        }
      };

      const normalized = normalizeAnalyticsSummary(payload);
      expect(normalized.summary.monthOverMonthPercentage).toBeNull();
      expect(Number.isNaN(normalized.summary.monthOverMonthPercentage)).toBe(false);
    });
  });

  describe('AnalyticsService.getMonthlySummary', () => {
    it('calls GET /analytics/summary with formatted query params and returns normalized data', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: mockRawPayload
      });

      const result = await AnalyticsService.getMonthlySummary({ month: 10, year: 2026 });

      expect(getSpy).toHaveBeenCalledWith('/analytics/summary', {
        params: { month: 10, year: 2026 }
      });
      expect(result.summary.totalSpending).toBe(42150.75);
      expect(result.summary.totalTransactions).toBe(35);
      expect(result.byCategory).toHaveLength(2);
      expect(result.byPaymentMethod).toHaveLength(2);
      expect(result.dailyTrend).toHaveLength(2);
    });

    it('omits undefined and empty query parameters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: mockRawPayload
      });

      await AnalyticsService.getMonthlySummary({});

      expect(getSpy).toHaveBeenCalledWith('/analytics/summary', {
        params: {}
      });
    });

    it('propagates API client errors directly to caller', async () => {
      const apiError = new Error('Request failed with status code 400');
      vi.spyOn(apiClient, 'get').mockRejectedValue(apiError);

      await expect(
        AnalyticsService.getMonthlySummary({ month: 99, year: 2026 })
      ).rejects.toThrow('Request failed with status code 400');
    });
  });
});
