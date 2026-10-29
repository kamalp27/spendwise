import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DashboardOverview from '../src/features/dashboard/DashboardOverview.jsx';
import { AnalyticsService } from '../src/services/analytics.service.js';
import { BudgetService } from '../src/services/budget.service.js';
import { AuthContext } from '../src/context/AuthContext.jsx';

function renderWithAuth(ui, { authValue = {} } = {}) {
  const defaultAuth = {
    status: 'authenticated',
    user: {
      id: 'test-user-id',
      email: 'alex@spendwise.example',
      displayName: 'Alex Chen',
      currency: 'INR'
    },
    error: null,
    refreshSession: vi.fn(),
    logout: vi.fn()
  };

  const mergedAuth = { ...defaultAuth, ...authValue };

  return render(
    <AuthContext.Provider value={mergedAuth}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('DashboardOverview Feature & Metrics Verification (Stage 6.2E7)', () => {
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

  const mockPopulatedAnalytics = {
    period: { month: 10, year: 2026 },
    summary: {
      totalSpending: 4500,
      totalTransactions: 12,
      averageExpense: 375,
      highestExpense: 1200,
      previousMonthSpending: 4000,
      monthOverMonthChange: 500,
      monthOverMonthPercentage: 12.5
    },
    byCategory: [
      {
        categoryId: 'cat-1',
        categoryName: 'Food & Dining',
        categoryIcon: 'utensils',
        categoryColor: '#EF4444',
        totalAmount: 2200,
        transactionCount: 6,
        percentage: 48.89
      },
      {
        categoryId: 'cat-2',
        categoryName: 'Transport',
        categoryIcon: 'car',
        categoryColor: '#F97316',
        totalAmount: 1300,
        transactionCount: 4,
        percentage: 28.89
      }
    ],
    byPaymentMethod: [],
    dailyTrend: []
  };

  const mockOverallBudget = {
    id: 'budget-overall-1',
    category_id: null,
    categoryId: null,
    amount: 10000,
    month: 10,
    year: 2026,
    actual_spent: 4500,
    actualSpent: 4500,
    remaining_amount: 5500,
    remainingAmount: 5500,
    percentage_used: 45.0,
    percentageUsed: 45.0,
    is_overall: true,
    isOverall: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Empty State
  it('renders clean empty state with ₹0.00 and actionable budget setup when no expenses or budgets exist', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockEmptyAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([]);

    const onSelectTab = vi.fn();

    const { container } = renderWithAuth(
      <DashboardOverview onSelectTab={onSelectTab} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText('₹0.00')).toBeDefined();
    });

    // Check Total Expenses card
    expect(screen.getByText('0 recorded transactions in October 2026')).toBeDefined();

    // Check Monthly Budget unset state with actionable button
    expect(screen.getByText('No budget defined')).toBeDefined();
    expect(screen.getByText('Unset')).toBeDefined();
    const setBudgetBtn = screen.getByRole('button', { name: /Set a budget in the Budgets tab/i });
    expect(setBudgetBtn).toBeDefined();

    // Clicking set budget button triggers navigation to budgets view
    fireEvent.click(setBudgetBtn);
    expect(onSelectTab).toHaveBeenCalledWith('budgets');

    // Check Remaining Budget awaiting state
    expect(screen.getByText('Awaiting budget definition')).toBeDefined();
    expect(screen.getByText('Define a monthly budget to track spend')).toBeDefined();

    // Check Top Category empty state
    const summaryCardsSection = screen.getByLabelText('Financial Summary Cards');
    expect(within(summaryCardsSection).getAllByText('—').length).toBeGreaterThan(0);

    // Verify complete absence of obsolete Stage 5.4 strings
    expect(container.textContent).not.toContain('Stage 5.4');
    expect(container.textContent).not.toContain('Budgeting arrives in Stage 5.4');
  });

  // 2. Populated Month with Overall Budget
  it('renders authoritative monthly spending, overall budget cap, remaining balance, and top category', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);
    });

    // Total Expenses
    expect(screen.getByText('12 recorded transactions')).toBeDefined();

    // Monthly Budget: ₹10000.00, Overall Spending Cap, 45.0% of limit used
    expect(screen.getByText('₹10000.00')).toBeDefined();
    expect(screen.getByText('Overall Spending Cap')).toBeDefined();
    expect(screen.getByText('45.0% of limit used')).toBeDefined();

    // Remaining Budget: ₹5500.00, Available to spend, On Track badge
    expect(screen.getByText('₹5500.00')).toBeDefined();
    expect(screen.getByText('Available to spend')).toBeDefined();
    expect(screen.getByText('On Track')).toBeDefined();
    expect(screen.getByText('₹5500.00 remaining of monthly cap')).toBeDefined();

    // Top Category: Food & Dining
    expect(screen.getAllByText('Food & Dining').length).toBeGreaterThan(0);
    expect(screen.getByText('₹2200.00 total spend')).toBeDefined();
  });

  // 3. Over-Budget State
  it('renders over-budget state with negative balance and Exceeded badge when spending exceeds cap', async () => {
    const overBudgetAnalytics = {
      ...mockPopulatedAnalytics,
      summary: {
        ...mockPopulatedAnalytics.summary,
        totalSpending: 12000,
        totalTransactions: 25
      }
    };

    const overBudgetItem = {
      ...mockOverallBudget,
      actual_spent: 12000,
      actualSpent: 12000,
      remaining_amount: -2000,
      remainingAmount: -2000,
      percentage_used: 120.0,
      percentageUsed: 120.0
    };

    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(overBudgetAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([overBudgetItem]);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getAllByText('₹12000.00').length).toBeGreaterThan(0);
    });

    // Remaining Budget shows -₹2000.00 and Exceeded badge
    expect(screen.getByText('-₹2000.00')).toBeDefined();
    expect(screen.getByText('Over budget')).toBeDefined();
    expect(screen.getAllByText('Exceeded').length).toBeGreaterThan(0);
    expect(screen.getByText('Exceeded by ₹2000.00')).toBeDefined();
  });

  // 4. Category Budgets Without Overall Budget
  it('displays category-budget summary without falsely claiming an overall budget when only category caps exist', async () => {
    const categoryBudgets = [
      {
        id: 'b-cat-1',
        category_id: 'cat-1',
        categoryId: 'cat-1',
        amount: 3000,
        actualSpent: 1200,
        remainingAmount: 1800,
        isOverall: false,
        categoryName: 'Food & Dining'
      },
      {
        id: 'b-cat-2',
        category_id: 'cat-2',
        categoryId: 'cat-2',
        amount: 2000,
        actualSpent: 800,
        remainingAmount: 1200,
        isOverall: false,
        categoryName: 'Transport'
      }
    ];

    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue(categoryBudgets);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText('₹5000.00')).toBeDefined();
    });

    // Subtitle indicates 2 Category Caps
    expect(screen.getByText('2 Category Caps')).toBeDefined();
    expect(screen.getAllByText('Allocated').length).toBeGreaterThan(0);
    expect(screen.getByText('Category-specific allocations')).toBeDefined();

    // Does NOT display Overall Spending Cap
    expect(screen.queryByText('Overall Spending Cap')).toBeNull();

    // Remaining across categories: 5000 - 2000 = 3000
    expect(screen.getByText('₹3000.00')).toBeDefined();
    expect(screen.getByText('Category remaining')).toBeDefined();
    expect(screen.getByText('₹3000.00 available across categories')).toBeDefined();
  });

  // 5. Multi-Page Pagination Independence (>50 expenses)
  it('displays authoritative monthly total from analytics independent of the visible page transaction count', async () => {
    // 5 visible transactions representing page 1 of 500 records
    const visiblePageTransactions = [
      { id: 'tx-1', amount: 100, title: 'Item 1', date: '2026-10-25' },
      { id: 'tx-2', amount: 150, title: 'Item 2', date: '2026-10-24' },
      { id: 'tx-3', amount: 200, title: 'Item 3', date: '2026-10-23' },
      { id: 'tx-4', amount: 250, title: 'Item 4', date: '2026-10-22' },
      { id: 'tx-5', amount: 300, title: 'Item 5', date: '2026-10-21' }
    ];

    const multiPageAnalytics = {
      period: { month: 10, year: 2026 },
      summary: {
        totalSpending: 85200.5,
        totalTransactions: 500,
        averageExpense: 170.4,
        highestExpense: 4200,
        previousMonthSpending: 78000,
        monthOverMonthChange: 7200.5,
        monthOverMonthPercentage: 9.23
      },
      byCategory: [
        {
          categoryId: 'cat-bulk',
          categoryName: 'Enterprise Tools',
          totalAmount: 42000,
          transactionCount: 150,
          percentage: 49.3
        }
      ],
      byPaymentMethod: [],
      dailyTrend: []
    };

    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(multiPageAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([]);

    renderWithAuth(
      <DashboardOverview
        onSelectTab={vi.fn()}
        transactions={visiblePageTransactions}
        pagination={{ total: 500, page: 1, limit: 50, totalPages: 10 }}
      />
    );

    // Total Expenses card must show authoritative total ₹85200.50 (NOT 100+150+200+250+300 = 1000)
    await waitFor(() => {
      expect(screen.getAllByText('₹85200.50').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('500 recorded transactions')).toBeDefined();
    expect(screen.queryByText('₹1000.00')).toBeNull();

    // Recent transactions card still shows the preview items
    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 5')).toBeDefined();
  });

  // 6. Analytics Failure & Retry
  it('displays error alert and dash placeholder on affected cards when analytics request fails', async () => {
    const analyticsSpy = vi
      .spyOn(AnalyticsService, 'getMonthlySummary')
      .mockRejectedValueOnce(new Error('Analytics service unavailable'))
      .mockResolvedValueOnce(mockPopulatedAnalytics);

    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Analytics service unavailable/i)).toBeDefined();
    });

    // Total Expenses card shows '—' (does NOT silently treat as 0 or invent values)
    const summaryCardsSection = screen.getByLabelText('Financial Summary Cards');
    expect(within(summaryCardsSection).getAllByText('—').length).toBeGreaterThan(0);

    // Budget service still succeeded, so budget cards display normally
    expect(screen.getByText('₹10000.00')).toBeDefined();
    expect(screen.getByText('₹5500.00')).toBeDefined();

    // Click Retry Sync
    const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
    fireEvent.click(retryBtn);

    // Verify recovery
    await waitFor(() => {
      expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);
    });
    expect(analyticsSpy).toHaveBeenCalledTimes(2);
  });

  // 7. Budget Failure & Retry
  it('displays error alert and dash placeholder on budget cards when budget service fails', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    const budgetSpy = vi
      .spyOn(BudgetService, 'listBudgets')
      .mockRejectedValueOnce(new Error('Budget database timeout'))
      .mockResolvedValueOnce([mockOverallBudget]);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Budget database timeout/i)).toBeDefined();
    });

    // Monthly Budget & Remaining Budget cards show '—'
    expect(screen.getAllByText('Budget sync error').length).toBeGreaterThan(0);

    // Analytics succeeded, so total expenses displays normally
    expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);

    // Retry
    const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('₹10000.00')).toBeDefined();
    });
    expect(budgetSpy).toHaveBeenCalledTimes(2);
  });

  // 8. User Currency Formatting Preference
  it('formats all financial metrics with the user preferred currency (e.g. USD)', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

    renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />,
      {
        authValue: {
          user: {
            id: 'usd-user',
            email: 'usd@spendwise.example',
            displayName: 'USD User',
            currency: 'USD'
          }
        }
      }
    );

    await waitFor(() => {
      expect(screen.getAllByText('$4500.00').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('$10000.00')).toBeDefined();
    expect(screen.getByText('$5500.00')).toBeDefined();
    expect(screen.getByText('USD ($)')).toBeDefined();
  });

  // 9. Session Purging on Logout
  it('clears sensitive financial overview metrics immediately when authentication session transitions to unauthenticated', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

    const { rerender } = renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />,
      { authValue: { status: 'authenticated' } }
    );

    await waitFor(() => {
      expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);
    });

    // Now transition to unauthenticated (logout)
    rerender(
      <AuthContext.Provider
        value={{
          status: 'unauthenticated',
          user: null,
          error: null,
          refreshSession: vi.fn(),
          logout: vi.fn()
        }}
      >
        <DashboardOverview onSelectTab={vi.fn()} transactions={[]} />
      </AuthContext.Provider>
    );

    // Financial values purged to '—'
    expect(screen.queryByText('₹4500.00')).toBeNull();
    expect(screen.queryByText('₹10000.00')).toBeNull();
  });

  // 10. Navigation Actions
  it('navigates to relevant tabs when clicking interactive links and buttons', async () => {
    vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockPopulatedAnalytics);
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

    const onSelectTab = vi.fn();
    const onAddExpense = vi.fn();

    renderWithAuth(
      <DashboardOverview
        onSelectTab={onSelectTab}
        onAddExpense={onAddExpense}
        transactions={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);
    });

    // Click New Expense
    const newExpenseBtn = screen.getByRole('button', { name: /New Expense/i });
    fireEvent.click(newExpenseBtn);
    expect(onAddExpense).toHaveBeenCalledTimes(1);

    // Click Category Manage button
    const manageCategoriesBtn = screen.getByRole('button', { name: /Manage/i });
    fireEvent.click(manageCategoriesBtn);
    expect(onSelectTab).toHaveBeenCalledWith('categories');

    // Click View Spending Trends button (in SpendingChartCard)
    const trendsBtn = screen.getByRole('button', { name: /View detailed spending trends and breakdown/i });
    fireEvent.click(trendsBtn);
    expect(onSelectTab).toHaveBeenCalledWith('analytics');
  });
});

describe('DashboardOverview Stage 6.2E9 Enhancements (Dynamic Period & Retry Protection)', () => {
  const mockAnalyticsData = {
    period: { month: 10, year: 2026 },
    summary: {
      totalSpending: 4500,
      totalTransactions: 12,
      averageExpense: 375,
      highestExpense: 1200,
      previousMonthSpending: 4000,
      monthOverMonthChange: 500,
      monthOverMonthPercentage: 12.5
    },
    byCategory: [
      {
        categoryId: 'cat-1',
        categoryName: 'Food & Dining',
        categoryIcon: 'utensils',
        categoryColor: '#EF4444',
        totalAmount: 2200,
        transactionCount: 6,
        percentage: 48.89
      }
    ],
    byPaymentMethod: [],
    dailyTrend: []
  };

  const mockBudgets = [
    {
      id: 'budget-1',
      category_id: null,
      categoryId: null,
      amount: 10000,
      actual_spent: 4500,
      actualSpent: 4500,
      is_overall: true,
      isOverall: true
    }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Dynamic local month/year default & identical parameters
  it('dynamically queries current local month and year when props are omitted, passing identical parameters to analytics and budget services', async () => {
    const analyticsSpy = vi.spyOn(AnalyticsService, 'getMonthlySummary').mockResolvedValue(mockAnalyticsData);
    const budgetSpy = vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue(mockBudgets);

    const now = new Date();
    const expectedMonth = now.getMonth() + 1;
    const expectedYear = now.getFullYear();

    renderWithAuth(<DashboardOverview onSelectTab={vi.fn()} transactions={[]} />);

    await waitFor(() => {
      expect(analyticsSpy).toHaveBeenCalled();
      expect(budgetSpy).toHaveBeenCalled();
    });

    const analyticsCall = analyticsSpy.mock.calls[0][0];
    const budgetCall = budgetSpy.mock.calls[0][0];

    expect(analyticsCall).toEqual({ month: expectedMonth, year: expectedYear });
    expect(budgetCall).toEqual({ month: expectedMonth, year: expectedYear });
    expect(analyticsCall.month).toBe(budgetCall.month);
    expect(analyticsCall.year).toBe(budgetCall.year);
  });

  // Test 2: Retry button protection while syncing
  it('disables the retry button during sync, shows syncing indicator, and prevents concurrent click dispatches', async () => {
    const analyticsSpy = vi.spyOn(AnalyticsService, 'getMonthlySummary')
      .mockImplementationOnce(() => Promise.reject(new Error('Network error')));
    vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue(mockBudgets);

    renderWithAuth(<DashboardOverview onSelectTab={vi.fn()} transactions={[]} month={10} year={2026} />);

    // Wait for error banner
    await waitFor(() => {
      expect(screen.getByText(/Failed to synchronize financial data:/i)).toBeDefined();
    });

    // Setup second call to hang until we manually resolve it
    let resolveRetry;
    const pendingRetryPromise = new Promise((resolve) => {
      resolveRetry = resolve;
    });
    analyticsSpy.mockImplementationOnce(() => pendingRetryPromise);

    const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
    expect(retryBtn).toBeDefined();
    expect(retryBtn.disabled).toBe(false);

    // Click retry
    fireEvent.click(retryBtn);

    // Button should now be disabled and display "Syncing..."
    await waitFor(() => {
      expect(retryBtn.disabled).toBe(true);
      expect(retryBtn.getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByText('Syncing...')).toBeDefined();
    });

    // Attempt concurrent click while syncing
    fireEvent.click(retryBtn);

    // analyticsSpy should only have been called twice (initial load + first retry), NOT three times
    expect(analyticsSpy).toHaveBeenCalledTimes(2);

    // Resolve pending retry
    resolveRetry(mockAnalyticsData);

    // After resolution, error banner should disappear
    await waitFor(() => {
      expect(screen.queryByText(/Failed to synchronize financial data:/i)).toBeNull();
    });
  });

  // Test 3: Reporting period change clears stale data immediately
  it('clears stale data immediately when reporting period prop changes so old month metrics are not displayed while loading', async () => {
    let resolveNovAnalytics;
    const novAnalyticsPromise = new Promise((resolve) => {
      resolveNovAnalytics = resolve;
    });

    vi.spyOn(AnalyticsService, 'getMonthlySummary')
      .mockResolvedValueOnce(mockAnalyticsData) // month 10
      .mockImplementationOnce(() => novAnalyticsPromise); // month 11 pending

    vi.spyOn(BudgetService, 'listBudgets')
      .mockResolvedValueOnce(mockBudgets)
      .mockImplementationOnce(() => Promise.resolve([]));

    const { rerender } = renderWithAuth(
      <DashboardOverview onSelectTab={vi.fn()} transactions={[]} month={10} year={2026} />
    );

    // Confirm initial October data is displayed
    await waitFor(() => {
      expect(screen.getAllByText('₹4500.00').length).toBeGreaterThan(0);
      expect(screen.getByText(/October 2026/i)).toBeDefined();
    });

    // Change period prop to November 2026
    rerender(
      <AuthContext.Provider
        value={{
          status: 'authenticated',
          user: { id: 'test-user-id', currency: 'INR' },
          error: null,
          refreshSession: vi.fn(),
          logout: vi.fn()
        }}
      >
        <DashboardOverview onSelectTab={vi.fn()} transactions={[]} month={11} year={2026} />
      </AuthContext.Provider>
    );

    // Old month data should be immediately cleared (replaced with '—') while November is still pending
    expect(screen.queryByText('₹4500.00')).toBeNull();
    expect(screen.queryByText(/October 2026/i)).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    // Now resolve November data
    const mockNovAnalytics = {
      ...mockAnalyticsData,
      period: { month: 11, year: 2026 },
      summary: {
        ...mockAnalyticsData.summary,
        totalSpending: 7800
      }
    };
    resolveNovAnalytics(mockNovAnalytics);

    // November data should appear once resolved
    await waitFor(() => {
      expect(screen.getAllByText('₹7800.00').length).toBeGreaterThan(0);
      expect(screen.getByText(/November 2026/i)).toBeDefined();
    });
  });
});

