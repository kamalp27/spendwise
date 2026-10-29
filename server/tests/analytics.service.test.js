import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../src/services/analytics.service.js';
import { AnalyticsController } from '../src/controllers/analytics.controller.js';

describe('Analytics Service & Controller (Stage 5.8A)', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const otherUserId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Parameter Validation & Security', () => {
    it('throws bad request when userId is invalid or not a UUID', async () => {
      const mockDb = { query: vi.fn() };
      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, 'invalid-uuid', { month: 10, year: 2026 })
      ).rejects.toThrow(/must be a valid UUID/);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws bad request when month is missing', async () => {
      const mockDb = { query: vi.fn() };
      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { year: 2026 })
      ).rejects.toThrow(/month is required/i);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws bad request when month is out of 1-12 range', async () => {
      const mockDb = { query: vi.fn() };
      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 0, year: 2026 })
      ).rejects.toThrow(/integer between 1 and 12/i);

      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 13, year: 2026 })
      ).rejects.toThrow(/integer between 1 and 12/i);

      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 5.5, year: 2026 })
      ).rejects.toThrow(/integer between 1 and 12/i);
    });

    it('throws bad request when year is missing', async () => {
      const mockDb = { query: vi.fn() };
      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 10 })
      ).rejects.toThrow(/year is required/i);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws bad request when year is out of 2024-2100 range', async () => {
      const mockDb = { query: vi.fn() };
      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 10, year: 2023 })
      ).rejects.toThrow(/integer between 2024 and 2100/i);

      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, { month: 10, year: 2101 })
      ).rejects.toThrow(/integer between 2024 and 2100/i);
    });

    it('enforces strict user isolation in all 5 aggregation queries', async () => {
      const queryParamsCaptured = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          expect(sql).toContain('WHERE e.user_id = $1');
          expect(params[0]).toBe(testUserId);
          queryParamsCaptured.push({ sql, params });
          return { rows: [] };
        })
      };

      await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(mockDb.query).toHaveBeenCalledTimes(5);
      expect(queryParamsCaptured.length).toBe(5);
      queryParamsCaptured.forEach((q) => {
        expect(q.params[0]).toBe(testUserId);
        expect(q.params[0]).not.toBe(otherUserId);
      });
    });
  });

  describe('Date Boundary Calculations & Rollover', () => {
    it('sets standard month boundaries for October 2026 (inclusive start, exclusive next-month start)', async () => {
      const calls = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          calls.push({ sql, params });
          return { rows: [] };
        })
      };

      await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      // Current month queries (summary, category, payment, daily) should use:
      // startDate: '2026-10-01', nextMonthStartDate: '2026-11-01'
      // Previous month query should use:
      // prevStartDate: '2026-09-01', prevEndDate: '2026-10-01'
      const summaryCall = calls[0];
      expect(summaryCall.params).toEqual([testUserId, '2026-10-01', '2026-11-01']);

      const prevCall = calls[1];
      expect(prevCall.params).toEqual([testUserId, '2026-09-01', '2026-10-01']);
    });

    it('correctly calculates December-to-January next-month rollover', async () => {
      const calls = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          calls.push({ sql, params });
          return { rows: [] };
        })
      };

      await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 12,
        year: 2026
      });

      const summaryCall = calls[0];
      expect(summaryCall.params).toEqual([testUserId, '2026-12-01', '2027-01-01']);

      const prevCall = calls[1];
      expect(prevCall.params).toEqual([testUserId, '2026-11-01', '2026-12-01']);
    });

    it('correctly calculates January previous-month rollover to December of preceding year', async () => {
      const calls = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          calls.push({ sql, params });
          return { rows: [] };
        })
      };

      await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 1,
        year: 2026
      });

      const summaryCall = calls[0];
      expect(summaryCall.params).toEqual([testUserId, '2026-01-01', '2026-02-01']);

      const prevCall = calls[1];
      // January 2026 previous month is December 2025
      expect(prevCall.params).toEqual([testUserId, '2025-12-01', '2026-01-01']);
    });
  });

  describe('Monthly Aggregation Calculations & Precision', () => {
    it('aggregates summary metrics, converting PostgreSQL string numbers accurately', async () => {
      const mockSummary = {
        total_spending: '35450.75',
        total_transactions: '28',
        average_expense: '1266.10',
        highest_expense: '5500.00'
      };

      const mockPrevSummary = {
        previous_month_spending: '30000.00'
      };

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('previous_month_spending')) {
            return { rows: [mockPrevSummary] };
          }
          if (sql.includes('total_spending')) {
            return { rows: [mockSummary] };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.period).toEqual({ month: 10, year: 2026 });
      expect(result.summary.totalSpending).toBe(35450.75);
      expect(result.summary.totalTransactions).toBe(28);
      expect(result.summary.averageExpense).toBe(1266.1);
      expect(result.summary.highestExpense).toBe(5500);
      expect(result.summary.previousMonthSpending).toBe(30000);
      expect(result.summary.monthOverMonthChange).toBe(5450.75);
      // ((35450.75 - 30000) / 30000) * 100 = 18.17%
      expect(result.summary.monthOverMonthPercentage).toBe(18.17);
    });

    it('handles empty month with zero totals and empty breakdown arrays', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.summary).toEqual({
        totalSpending: 0,
        totalTransactions: 0,
        averageExpense: 0,
        highestExpense: 0,
        previousMonthSpending: 0,
        monthOverMonthChange: 0,
        monthOverMonthPercentage: null
      });
      expect(result.byCategory).toEqual([]);
      expect(result.byPaymentMethod).toEqual([]);
      expect(result.dailyTrend).toEqual([]);
    });

    it('returns null for monthOverMonthPercentage when previous month has zero spending', async () => {
      const mockSummary = {
        total_spending: '12000.00',
        total_transactions: '10',
        average_expense: '1200.00',
        highest_expense: '3000.00'
      };

      const mockPrevSummary = {
        previous_month_spending: '0.00'
      };

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('previous_month_spending')) {
            return { rows: [mockPrevSummary] };
          }
          if (sql.includes('total_spending')) {
            return { rows: [mockSummary] };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.summary.totalSpending).toBe(12000);
      expect(result.summary.previousMonthSpending).toBe(0);
      expect(result.summary.monthOverMonthChange).toBe(12000);
      // Mathematically undefined division by zero must yield null, NEVER Infinity or NaN
      expect(result.summary.monthOverMonthPercentage).toBeNull();
      expect(Number.isFinite(result.summary.monthOverMonthPercentage)).toBe(false);
    });

    it('calculates negative month-over-month change when spending decreases', async () => {
      const mockSummary = {
        total_spending: '15000.00',
        total_transactions: '8',
        average_expense: '1875.00',
        highest_expense: '4000.00'
      };

      const mockPrevSummary = {
        previous_month_spending: '20000.00'
      };

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('previous_month_spending')) {
            return { rows: [mockPrevSummary] };
          }
          if (sql.includes('total_spending')) {
            return { rows: [mockSummary] };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.summary.monthOverMonthChange).toBe(-5000);
      // ((15000 - 20000) / 20000) * 100 = -25.00%
      expect(result.summary.monthOverMonthPercentage).toBe(-25);
    });
  });

  describe('Category Breakdown Aggregation', () => {
    it('aggregates category spending, calculates distribution percentages, and falls back for uncategorized expenses', async () => {
      const mockSummary = {
        total_spending: '10000.00',
        total_transactions: '5',
        average_expense: '2000.00',
        highest_expense: '5000.00'
      };

      const mockCategories = [
        {
          category_id: 'cat-uuid-1',
          category_name: 'Food & Dining',
          category_icon: 'utensils',
          category_color: '#F59E0B',
          total_amount: '5000.00',
          transaction_count: '2'
        },
        {
          category_id: 'cat-uuid-2',
          category_name: 'Transport',
          category_icon: 'car',
          category_color: '#3B82F6',
          total_amount: '3000.00',
          transaction_count: '2'
        },
        {
          category_id: null,
          category_name: 'Uncategorized',
          category_icon: 'tag',
          category_color: '#6B7280',
          total_amount: '2000.00',
          transaction_count: '1'
        }
      ];

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('total_spending')) {
            return { rows: [mockSummary] };
          }
          if (sql.includes('LEFT JOIN categories')) {
            return { rows: mockCategories };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.byCategory).toHaveLength(3);

      const food = result.byCategory[0];
      expect(food.categoryId).toBe('cat-uuid-1');
      expect(food.categoryName).toBe('Food & Dining');
      expect(food.totalAmount).toBe(5000);
      expect(food.transactionCount).toBe(2);
      expect(food.percentage).toBe(50); // 5000 / 10000 * 100

      const transport = result.byCategory[1];
      expect(transport.categoryId).toBe('cat-uuid-2');
      expect(transport.totalAmount).toBe(3000);
      expect(transport.percentage).toBe(30); // 3000 / 10000 * 100

      const uncategorized = result.byCategory[2];
      expect(uncategorized.categoryId).toBeNull();
      expect(uncategorized.categoryName).toBe('Uncategorized');
      expect(uncategorized.categoryColor).toBe('#6B7280');
      expect(uncategorized.categoryIcon).toBe('tag');
      expect(uncategorized.totalAmount).toBe(2000);
      expect(uncategorized.percentage).toBe(20); // 2000 / 10000 * 100

      // Reconciles perfectly to monthly total
      const categorySum = result.byCategory.reduce((acc, c) => acc + c.totalAmount, 0);
      expect(categorySum).toBe(result.summary.totalSpending);
    });
  });

  describe('Payment Method Distribution', () => {
    it('aggregates spending across all represented payment methods', async () => {
      const mockSummary = {
        total_spending: '20000.00',
        total_transactions: '4',
        average_expense: '5000.00',
        highest_expense: '10000.00'
      };

      const mockPayments = [
        {
          payment_method: 'UPI',
          total_amount: '12000.00',
          transaction_count: '2'
        },
        {
          payment_method: 'Credit Card',
          total_amount: '5000.00',
          transaction_count: '1'
        },
        {
          payment_method: 'Cash',
          total_amount: '3000.00',
          transaction_count: '1'
        }
      ];

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('total_spending')) {
            return { rows: [mockSummary] };
          }
          if (sql.includes('GROUP BY e.payment_method')) {
            return { rows: mockPayments };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.byPaymentMethod).toHaveLength(3);
      expect(result.byPaymentMethod[0]).toEqual({
        paymentMethod: 'UPI',
        totalAmount: 12000,
        transactionCount: 2,
        percentage: 60 // 12000 / 20000 * 100
      });
      expect(result.byPaymentMethod[1]).toEqual({
        paymentMethod: 'Credit Card',
        totalAmount: 5000,
        transactionCount: 1,
        percentage: 25 // 5000 / 20000 * 100
      });
      expect(result.byPaymentMethod[2]).toEqual({
        paymentMethod: 'Cash',
        totalAmount: 3000,
        transactionCount: 1,
        percentage: 15 // 3000 / 20000 * 100
      });
    });
  });

  describe('Daily Spending Chronological Trend', () => {
    it('returns daily totals in chronological order without fabricating missing dates', async () => {
      const mockDaily = [
        { date: '2026-10-02', daily_total: '1200.50', transaction_count: '1' },
        { date: '2026-10-15', daily_total: '3500.00', transaction_count: '2' },
        { date: '2026-10-28', daily_total: '450.00', transaction_count: '1' }
      ];

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('GROUP BY e.date')) {
            return { rows: mockDaily };
          }
          return { rows: [] };
        })
      };

      const result = await AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
        month: 10,
        year: 2026
      });

      expect(result.dailyTrend).toHaveLength(3);
      expect(result.dailyTrend[0]).toEqual({
        date: '2026-10-02',
        dailyTotal: 1200.5,
        transactionCount: 1
      });
      expect(result.dailyTrend[1]).toEqual({
        date: '2026-10-15',
        dailyTotal: 3500,
        transactionCount: 2
      });
      expect(result.dailyTrend[2]).toEqual({
        date: '2026-10-28',
        dailyTotal: 450,
        transactionCount: 1
      });
    });
  });

  describe('Database Error Handling', () => {
    it('propagates database query errors without swallowing', async () => {
      const dbError = new Error('Database connection failed');
      const mockDb = {
        query: vi.fn(async () => {
          throw dbError;
        })
      };

      await expect(
        AnalyticsService.getMonthlyAnalytics(mockDb, testUserId, {
          month: 10,
          year: 2026
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Analytics Controller (getMonthlySummary)', () => {
    it('returns 200 with structured data matching the envelope', async () => {
      const mockData = {
        period: { month: 10, year: 2026 },
        summary: { totalSpending: 5000 },
        byCategory: [],
        byPaymentMethod: [],
        dailyTrend: []
      };

      vi.spyOn(AnalyticsService, 'getMonthlyAnalytics').mockResolvedValue(mockData);

      const req = {
        user: { id: testUserId },
        query: { month: '10', year: '2026' },
        app: { locals: { db: {} } }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      await AnalyticsController.getMonthlySummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes errors to express next middleware', async () => {
      const testError = new Error('Invalid query parameters');
      vi.spyOn(AnalyticsService, 'getMonthlyAnalytics').mockRejectedValue(testError);

      const req = {
        user: { id: testUserId },
        query: { month: '99', year: '2026' },
        app: { locals: { db: {} } }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      await AnalyticsController.getMonthlySummary(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
});
