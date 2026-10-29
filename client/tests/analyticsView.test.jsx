import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsView from '../src/features/analytics/AnalyticsView.jsx';
import AnalyticsSummaryCards from '../src/features/analytics/AnalyticsSummaryCards.jsx';
import CategoryDonutChart from '../src/features/analytics/CategoryDonutChart.jsx';
import PaymentMethodDistribution from '../src/features/analytics/PaymentMethodDistribution.jsx';
import DailySpendingTrendChart from '../src/features/analytics/DailySpendingTrendChart.jsx';
import { AnalyticsService } from '../src/services/analytics.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';
import { BudgetService } from '../src/services/budget.service.js';
import App from '../src/App.jsx';

// Polyfill ResizeObserver for Recharts in jsdom environment
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

describe('Analytics UI & Feature (Stage 5.8B)', () => {
  const mockAnalyticsData = {
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

  const mockEmptyAnalytics = {
    period: { month: 10, year: 2026 },
    summary: {
      totalSpending: 0,
      totalTransactions: 0,
      averageExpense: 0,
      highestExpense: 0,
      previousMonthSpending: 0,
      monthOverMonthChange: 0,
      monthOverMonthPercentage: null
    },
    byCategory: [],
    byPaymentMethod: [],
    dailyTrend: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AnalyticsSummaryCards', () => {
    it('renders real aggregate summary metrics with correct monetary formatting', () => {
      render(
        <AnalyticsSummaryCards
          summary={mockAnalyticsData.summary}
          periodLabel="October 2026"
        />
      );

      expect(screen.getByText('Total Spending')).toBeDefined();
      expect(screen.getByText('₹42150.75')).toBeDefined();
      expect(screen.getByText('+10.9% (+₹4150.75)')).toBeDefined();

      expect(screen.getByText('Transactions')).toBeDefined();
      expect(screen.getByText('35')).toBeDefined();
      expect(screen.getByText('35 recorded expenses')).toBeDefined();

      expect(screen.getByText('Average Expense')).toBeDefined();
      expect(screen.getByText('₹1204.31')).toBeDefined();

      expect(screen.getByText('Highest Expense')).toBeDefined();
      expect(screen.getByText('₹6500.00')).toBeDefined();
    });

    it('handles null month-over-month percentage honestly as N/A without displaying 0% or NaN', () => {
      const summaryWithNullMom = {
        totalSpending: 15000,
        totalTransactions: 5,
        averageExpense: 3000,
        highestExpense: 5000,
        previousMonthSpending: 0,
        monthOverMonthChange: 15000,
        monthOverMonthPercentage: null
      };

      render(
        <AnalyticsSummaryCards
          summary={summaryWithNullMom}
          periodLabel="October 2026"
        />
      );

      expect(screen.getByText('MoM: N/A (No prior spending)')).toBeDefined();
      expect(
        screen.getByText('No recorded expenses in previous calendar month')
      ).toBeDefined();
      expect(screen.getByText('Baseline')).toBeDefined();
      expect(screen.queryByText('NaN')).toBeNull();
      expect(screen.queryByText('Infinity')).toBeNull();
    });

    it('renders negative month-over-month change with downward indicator', () => {
      const summaryWithDecrease = {
        totalSpending: 20000,
        totalTransactions: 8,
        averageExpense: 2500,
        highestExpense: 4000,
        previousMonthSpending: 25000,
        monthOverMonthChange: -5000,
        monthOverMonthPercentage: -20.0
      };

      render(
        <AnalyticsSummaryCards
          summary={summaryWithDecrease}
          periodLabel="October 2026"
        />
      );

      expect(screen.getByText('-20.0% (-₹5000.00)')).toBeDefined();
      expect(screen.getByText('Spending Down')).toBeDefined();
    });
  });

  describe('Chart Visualizations with Real Data & Empty States', () => {
    it('renders category distribution breakdown and handles uncategorized items', () => {
      render(
        <CategoryDonutChart
          byCategory={mockAnalyticsData.byCategory}
          totalSpending={mockAnalyticsData.summary.totalSpending}
        />
      );

      expect(screen.getByText('Category Distribution')).toBeDefined();
      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('36.1%')).toBeDefined();
      expect(screen.getByText('₹15200.00')).toBeDefined();

      expect(screen.getByText('Uncategorized')).toBeDefined();
      expect(screen.getByText('5.9%')).toBeDefined();
      expect(screen.getByText('₹2500.00')).toBeDefined();
    });

    it('renders category empty state when breakdown array is empty', () => {
      render(<CategoryDonutChart byCategory={[]} totalSpending={0} />);

      expect(screen.getByText('No category spending')).toBeDefined();
      expect(
        screen.getByText(/No expenses have been allocated to categories for this period/i)
      ).toBeDefined();
    });

    it('renders payment method breakdown with channel details', () => {
      render(
        <PaymentMethodDistribution
          byPaymentMethod={mockAnalyticsData.byPaymentMethod}
          totalSpending={mockAnalyticsData.summary.totalSpending}
        />
      );

      expect(screen.getByText('Payment Methods')).toBeDefined();
      expect(screen.getByText('UPI')).toBeDefined();
      expect(screen.getByText('₹26000.00')).toBeDefined();
      expect(screen.getByText('61.7%')).toBeDefined();

      expect(screen.getByText('Credit Card')).toBeDefined();
      expect(screen.getByText('₹16150.75')).toBeDefined();
      expect(screen.getByText('38.3%')).toBeDefined();
    });

    it('renders payment method empty state when breakdown array is empty', () => {
      render(
        <PaymentMethodDistribution byPaymentMethod={[]} totalSpending={0} />
      );

      expect(screen.getByText('No payment method data')).toBeDefined();
    });

    it('renders daily spending trend section with active days and peak metrics', () => {
      render(
        <DailySpendingTrendChart
          dailyTrend={mockAnalyticsData.dailyTrend}
          totalSpending={mockAnalyticsData.summary.totalSpending}
        />
      );

      expect(screen.getByText('Daily Spending Velocity')).toBeDefined();
      expect(screen.getByText(/Active Days:/i)).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText(/Peak:/i)).toBeDefined();
      expect(screen.getByText(/4200.00/)).toBeDefined();
    });

    it('renders daily trend empty state when no daily transactions exist', () => {
      render(<DailySpendingTrendChart dailyTrend={[]} totalSpending={0} />);

      expect(screen.getByText('No daily spending recorded')).toBeDefined();
    });
  });

  describe('AnalyticsView Period Navigation & Error Recovery', () => {
    it('loads and displays analytics on mount for default period (October 2026)', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 10, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      expect(screen.getByText('Analytics & Insights')).toBeDefined();
      expect(screen.getAllByText('October 2026').length).toBeGreaterThan(0);
      expect(screen.getByText('₹42150.75')).toBeDefined();
    });

    it('updates period and queries service when clicking Next and Previous month buttons', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={10} initialYear={2026} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 10, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      // Click Next month
      const nextBtn = screen.getByRole('button', { name: /Next month/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 11, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });
      expect(screen.getAllByText('November 2026').length).toBeGreaterThan(0);

      // Click Previous month back to October, then to September
      const prevBtn = screen.getByRole('button', { name: /Previous month/i });
      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 10, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 9, year: 2026 });
      });
      expect(screen.getAllByText('September 2026').length).toBeGreaterThan(0);
    });

    it('updates period when selecting month and year from dropdowns', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={10} initialYear={2026} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 10, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const monthSelect = screen.getByLabelText(/Select month/i);
      fireEvent.change(monthSelect, { target: { value: '4' } });

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 4, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const yearSelect = screen.getByLabelText(/Select year/i);
      fireEvent.change(yearSelect, { target: { value: '2027' } });

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 4, year: 2027 });
      });
    });

    it('displays error alert and permits retrying when API request fails', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockRejectedValueOnce(new Error('Gateway timeout'))
        .mockResolvedValueOnce(mockAnalyticsData);

      render(<AnalyticsView />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load analytics:/i)).toBeDefined();
        expect(screen.getByText(/Gateway timeout/i)).toBeDefined();
      });

      const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('₹42150.75')).toBeDefined();
      });
      expect(summarySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('AnalyticsView Period Navigation & Boundary Guards (Fix 1)', () => {
    it('disables and guards Previous Month at boundary (January 2024)', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={1} initialYear={2024} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 1, year: 2024 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const prevBtn = screen.getByRole('button', { name: /Previous month/i });
      expect(prevBtn.disabled).toBe(true);

      // Attempt clicking anyway
      fireEvent.click(prevBtn);
      expect(summarySpy).toHaveBeenCalledTimes(1); // Not called again with 2023
    });

    it('disables and guards Next Month at boundary (December 2030)', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={12} initialYear={2030} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 12, year: 2030 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const nextBtn = screen.getByRole('button', { name: /Next month/i });
      expect(nextBtn.disabled).toBe(true);

      // Attempt clicking anyway
      fireEvent.click(nextBtn);
      expect(summarySpy).toHaveBeenCalledTimes(1); // Not called again with 2031
    });

    it('supports normal December-to-January rollover', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={12} initialYear={2025} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 12, year: 2025 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const nextBtn = screen.getByRole('button', { name: /Next month/i });
      expect(nextBtn.disabled).toBe(false);
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 1, year: 2026 });
      });
      expect(screen.getAllByText('January 2026').length).toBeGreaterThan(0);
    });

    it('supports normal January-to-December rollover', async () => {
      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockResolvedValue(mockAnalyticsData);

      render(<AnalyticsView initialMonth={1} initialYear={2026} />);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 1, year: 2026 });
        expect(screen.queryByText(/Syncing Analytics/i)).toBeNull();
      });

      const prevBtn = screen.getByRole('button', { name: /Previous month/i });
      expect(prevBtn.disabled).toBe(false);
      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(summarySpy).toHaveBeenCalledWith({ month: 12, year: 2025 });
      });
      expect(screen.getAllByText('December 2025').length).toBeGreaterThan(0);
    });
  });

  describe('Async Request Lifecycle & Concurrency Safety (Fix 2)', () => {
    it('discards state updates and does not crash when component unmounts during pending request', async () => {
      let resolvePromise;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.spyOn(AnalyticsService, 'getMonthlySummary').mockReturnValue(delayedPromise);

      const { unmount } = render(<AnalyticsView initialMonth={10} initialYear={2026} />);

      // Unmount while request is in flight
      unmount();

      // Resolve the request after unmount
      resolvePromise(mockAnalyticsData);

      // Verify no crash or unhandled error
      await new Promise((r) => setTimeout(r, 20));
    });

    it('discards stale out-of-order response when period changes', async () => {
      let resolveStale;
      const stalePromise = new Promise((resolve) => {
        resolveStale = resolve;
      });

      const newerData = {
        ...mockAnalyticsData,
        period: { month: 11, year: 2026 },
        summary: {
          ...mockAnalyticsData.summary,
          totalSpending: 99999.0
        }
      };

      const summarySpy = vi
        .spyOn(AnalyticsService, 'getMonthlySummary')
        .mockReturnValueOnce(stalePromise) // First call (Oct 2026) is slow
        .mockResolvedValueOnce(newerData); // Second call (Nov 2026) is fast

      render(<AnalyticsView initialMonth={10} initialYear={2026} />);

      // While call 1 is pending, change month to November 2026
      const monthSelect = screen.getByLabelText(/Select month/i);
      fireEvent.change(monthSelect, { target: { value: '11' } });

      // Call 2 resolves first
      await waitFor(() => {
        expect(screen.getByText('₹99999.00')).toBeDefined();
      });

      // Now call 1 resolves late with stale data (totalSpending: 42150.75)
      resolveStale(mockAnalyticsData);

      // Give event loop time to process late resolution
      await new Promise((r) => setTimeout(r, 20));

      // Newer data must remain on screen, NOT overwritten by stale response
      expect(screen.getByText('₹99999.00')).toBeDefined();
      expect(screen.queryByText('₹42150.75')).toBeNull();
    });
  });

  describe('Integration with App: Navigation & Tab Switching', () => {
    it('navigates seamlessly to Analytics view from the sidebar navigation', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });
      vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([]);
      vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockAnalyticsData);

      render(<App />);

      // Initial tab is overview
      expect(screen.getByLabelText('Financial Summary Cards')).toBeDefined();

      // Navigate to Analytics tab
      const analyticsNavBtn = screen.getByRole('button', { name: /Analytics/i });
      fireEvent.click(analyticsNavBtn);

      await waitFor(() => {
        expect(
          screen.getAllByRole('heading', { level: 1, name: 'Analytics & Insights' }).length
        ).toBeGreaterThan(0);
      });

      expect(screen.getByText('₹42150.75')).toBeDefined();
      expect(screen.getByText('Category Distribution')).toBeDefined();
      expect(screen.getByText('Payment Methods')).toBeDefined();
      expect(screen.getByText('Daily Spending Velocity')).toBeDefined();
    });
  });
});
