import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Receipt,
  PiggyBank,
  Wallet,
  Tags,
  Plus,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import SummaryCard from '../../components/common/SummaryCard.jsx';
import SpendingChartCard from './SpendingChartCard.jsx';
import RecentTransactionsCard from './RecentTransactionsCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { AnalyticsService } from '../../services/analytics.service.js';
import { BudgetService } from '../../services/budget.service.js';
import { useAuth } from '../../context/AuthContext.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

function getCurrencySymbol(curr = 'INR') {
  return CURRENCY_SYMBOLS[curr] || `${curr} `;
}

export default function DashboardOverview({
  onSelectTab,
  transactions = [],
  onAddExpense,
  isLoading = false,
  error = null,
  onRetry = null,
  pagination = null,
  month = null,
  year = null
}) {
  const { user, status } = useAuth();
  const userCurrency = user?.currency || 'INR';
  const currencySymbol = getCurrencySymbol(userCurrency);
  const currencyBadge = userCurrency === 'INR' ? 'INR (₹)' : (userCurrency === 'USD' ? 'USD ($)' : (userCurrency === 'EUR' ? 'EUR (€)' : userCurrency));

  // Dynamically obtain current local month (1-12) and year if not explicitly passed
  const { activeMonth, activeYear } = useMemo(() => {
    const now = new Date();
    const resolvedMonth = month !== undefined && month !== null ? Number(month) : now.getMonth() + 1;
    const resolvedYear = year !== undefined && year !== null ? Number(year) : now.getFullYear();
    return {
      activeMonth: Math.min(12, Math.max(1, resolvedMonth)),
      activeYear: resolvedYear
    };
  }, [month, year]);

  const formatCurrency = useCallback((amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '—';
    }
    const num = Number(amount);
    const isNegative = num < 0;
    return `${isNegative ? '-' : ''}${currencySymbol}${Math.abs(num).toFixed(2)}`;
  }, [currencySymbol]);

  // Period Labels
  const periodMonthName = MONTH_NAMES[activeMonth - 1] || `Month ${activeMonth}`;
  const periodLabel = `${periodMonthName} ${activeYear}`;

  // Synchronous fallback values from transactions
  const transactionsTotal = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return null;
    return transactions.reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
  }, [transactions]);

  const topCategoryFromTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return null;
    const totals = {};
    for (const tx of transactions) {
      const cat = tx.categoryName || tx.category || 'Other';
      totals[cat] = (totals[cat] || 0) + Number(tx.amount || 0);
    }
    let maxCat = null;
    let maxVal = 0;
    for (const [cat, val] of Object.entries(totals)) {
      if (val > maxVal) {
        maxVal = val;
        maxCat = cat;
      }
    }
    return maxCat;
  }, [transactions]);

  // Concurrency and Lifecycle References
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  // Authoritative State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [budgetsData, setBudgetsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [budgetsError, setBudgetsError] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear stale data immediately whenever active reporting period changes
  useEffect(() => {
    setAnalyticsData(null);
    setBudgetsData(null);
    setAnalyticsError(null);
    setBudgetsError(null);
  }, [activeMonth, activeYear]);

  // Authoritative Data Fetching
  const loadDashboardData = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }
    const reqId = ++requestIdRef.current;
    setAnalyticsLoading(true);
    setBudgetsLoading(true);

    const [analyticsResult, budgetsResult] = await Promise.allSettled([
      AnalyticsService.getMonthlySummary({ month: activeMonth, year: activeYear }),
      BudgetService.listBudgets({ month: activeMonth, year: activeYear })
    ]);

    if (!isMountedRef.current || reqId !== requestIdRef.current || status !== 'authenticated') {
      return;
    }

    if (analyticsResult.status === 'fulfilled') {
      setAnalyticsData(analyticsResult.value);
      setAnalyticsError(null);
    } else {
      setAnalyticsData(null);
      setAnalyticsError(analyticsResult.reason?.message || 'Failed to load monthly analytics.');
    }
    setAnalyticsLoading(false);

    if (budgetsResult.status === 'fulfilled') {
      setBudgetsData(budgetsResult.value);
      setBudgetsError(null);
    } else {
      setBudgetsData(null);
      setBudgetsError(budgetsResult.reason?.message || 'Failed to load budgets.');
    }
    setBudgetsLoading(false);
  }, [activeMonth, activeYear, status]);

  // Query triggers & session purge
  useEffect(() => {
    if (status === 'authenticated') {
      loadDashboardData();
    } else {
      requestIdRef.current++;
      setAnalyticsData(null);
      setBudgetsData(null);
      setAnalyticsLoading(false);
      setBudgetsLoading(false);
      setAnalyticsError(null);
      setBudgetsError(null);
    }
  }, [status, loadDashboardData, transactions]);

  // Combined Loading & Error Status
  const [isRetrying, setIsRetrying] = useState(false);
  const isSyncing = isLoading || analyticsLoading || budgetsLoading || isRetrying;
  const activeError = error || analyticsError || budgetsError;

  const handleRetryAll = useCallback(async () => {
    if (isRetrying) {
      return;
    }
    setIsRetrying(true);
    try {
      if (onRetry) {
        await Promise.resolve(onRetry());
      }
      await loadDashboardData();
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [isRetrying, onRetry, loadDashboardData]);

  // Authoritative Metrics from Analytics
  const totalSpending = analyticsData?.summary?.totalSpending ?? null;
  const totalTransactions = analyticsData?.summary?.totalTransactions ?? null;
  const topCategoryItem = analyticsData?.byCategory?.[0] || null;
  const topCategoryName = topCategoryItem?.categoryName || null;
  const topCategoryAmount = topCategoryItem?.totalAmount ?? null;

  // Budget Metrics & Partitioning
  const { overallBudget, categoryBudgets } = useMemo(() => {
    if (!Array.isArray(budgetsData)) {
      return { overallBudget: null, categoryBudgets: [] };
    }
    let overall = null;
    const catBudgets = [];
    for (const b of budgetsData) {
      if (b.isOverall || b.is_overall || b.category_id === null || b.categoryId === null) {
        overall = b;
      } else {
        catBudgets.push(b);
      }
    }
    return {
      overallBudget: overall,
      categoryBudgets: catBudgets
    };
  }, [budgetsData]);

  const categoryBudgetsSummary = useMemo(() => {
    if (categoryBudgets.length === 0) return null;
    const sumCaps = categoryBudgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const sumSpent = categoryBudgets.reduce(
      (sum, b) => sum + Number(b.actualSpent !== undefined ? b.actualSpent : (b.actual_spent || 0)),
      0
    );
    const remaining = sumCaps - sumSpent;
    return {
      count: categoryBudgets.length,
      sumCaps,
      sumSpent,
      remaining
    };
  }, [categoryBudgets]);

  // Construct Card Props
  // 1. Total Expenses
  let totalExpensesValue = '—';
  let totalExpensesSubtitle = periodLabel;
  let totalExpensesHelper = 'Awaiting transaction data';

  if (analyticsError) {
    totalExpensesValue = '—';
    totalExpensesSubtitle = 'Failed to synchronize';
    totalExpensesHelper = 'Failed to load monthly expenses';
  } else if (analyticsData) {
    totalExpensesValue = formatCurrency(totalSpending);
    totalExpensesSubtitle =
      totalTransactions === 0
        ? periodLabel
        : `${totalTransactions} recorded transaction${totalTransactions === 1 ? '' : 's'}`;
    totalExpensesHelper =
      totalTransactions === 0
        ? `0 recorded transactions in ${periodLabel}`
        : `Total monthly spend for ${periodLabel}`;
  } else if (transactionsTotal !== null) {
    totalExpensesValue = formatCurrency(transactionsTotal);
    totalExpensesSubtitle = `${transactions.length} recorded expense(s)`;
    totalExpensesHelper = `Total across ${transactions.length} transaction(s)`;
  } else if (analyticsLoading) {
    totalExpensesValue = '—';
    totalExpensesSubtitle = 'Fetching records...';
    totalExpensesHelper = 'Fetching monthly records...';
  }

  // 2. Monthly Budget
  let monthlyBudgetValue = '—';
  let monthlyBudgetSubtitle = 'No budget defined';
  let monthlyBudgetBadge = 'Unset';
  let monthlyBudgetHelper = (
    <button
      type="button"
      onClick={() => onSelectTab && onSelectTab('budgets')}
      className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center space-x-1 underline decoration-blue-500/30 underline-offset-2"
    >
      <span>Set a budget in the Budgets tab</span>
      <ArrowRight className="w-3 h-3" aria-hidden="true" />
    </button>
  );

  if (budgetsError) {
    monthlyBudgetValue = '—';
    monthlyBudgetSubtitle = 'Budget sync error';
    monthlyBudgetBadge = 'Error';
    monthlyBudgetHelper = 'Failed to load budget data';
  } else if (budgetsLoading && !budgetsData) {
    monthlyBudgetValue = '—';
    monthlyBudgetSubtitle = 'Fetching budgets...';
    monthlyBudgetBadge = 'Loading';
    monthlyBudgetHelper = 'Loading monthly limits...';
  } else if (overallBudget) {
    const pct = Number(overallBudget.percentageUsed || 0);
    monthlyBudgetValue = formatCurrency(overallBudget.amount);
    monthlyBudgetSubtitle = 'Overall Spending Cap';
    monthlyBudgetBadge = pct > 100 ? 'Exceeded' : (pct >= 85 ? 'Near Limit' : 'Active');
    monthlyBudgetHelper = `${pct.toFixed(1)}% of limit used`;
  } else if (categoryBudgetsSummary) {
    monthlyBudgetValue = formatCurrency(categoryBudgetsSummary.sumCaps);
    monthlyBudgetSubtitle = `${categoryBudgetsSummary.count} Category Cap${categoryBudgetsSummary.count > 1 ? 's' : ''}`;
    monthlyBudgetBadge = 'Allocated';
    monthlyBudgetHelper = 'Category-specific allocations';
  }

  // 3. Remaining Budget
  let remainingBudgetValue = '—';
  let remainingBudgetSubtitle = 'Awaiting budget definition';
  let remainingBudgetBadge = 'Budget';
  let remainingBudgetHelper = 'Define a monthly budget to track spend';

  if (budgetsError) {
    remainingBudgetValue = '—';
    remainingBudgetSubtitle = 'Budget sync error';
    remainingBudgetBadge = 'Error';
    remainingBudgetHelper = 'Failed to load budget data';
  } else if (budgetsLoading && !budgetsData) {
    remainingBudgetValue = '—';
    remainingBudgetSubtitle = 'Fetching budgets...';
    remainingBudgetBadge = 'Loading';
    remainingBudgetHelper = 'Loading remaining balance...';
  } else if (overallBudget) {
    const amount = Number(overallBudget.amount || 0);
    const spent = Number(overallBudget.actualSpent !== undefined ? overallBudget.actualSpent : (overallBudget.actual_spent || 0));
    const remaining = Number(
      overallBudget.remainingAmount !== undefined ? overallBudget.remainingAmount : (amount - spent)
    );
    const isOver = remaining < 0;

    remainingBudgetValue = formatCurrency(remaining);
    remainingBudgetSubtitle = isOver ? 'Over budget' : 'Available to spend';
    remainingBudgetBadge = isOver ? 'Exceeded' : 'On Track';
    remainingBudgetHelper = isOver
      ? `Exceeded by ${formatCurrency(Math.abs(remaining))}`
      : `${formatCurrency(remaining)} remaining of monthly cap`;
  } else if (categoryBudgetsSummary) {
    const isOver = categoryBudgetsSummary.remaining < 0;
    remainingBudgetValue = formatCurrency(categoryBudgetsSummary.remaining);
    remainingBudgetSubtitle = isOver ? 'Category over budget' : 'Category remaining';
    remainingBudgetBadge = isOver ? 'Exceeded' : 'On Track';
    remainingBudgetHelper = isOver
      ? `Exceeded by ${formatCurrency(Math.abs(categoryBudgetsSummary.remaining))} across categories`
      : `${formatCurrency(categoryBudgetsSummary.remaining)} available across categories`;
  }

  // 4. Top Category
  let topCategoryValue = '—';
  let topCategorySubtitle = 'Highest spending group';
  let topCategoryHelper = 'Ranked by monthly volume';

  if (analyticsError) {
    topCategoryValue = '—';
    topCategorySubtitle = 'Highest spending group';
    topCategoryHelper = 'Failed to load category ranking';
  } else if (topCategoryName) {
    topCategoryValue = topCategoryName;
    topCategorySubtitle = 'Highest spending volume';
    topCategoryHelper = `${formatCurrency(topCategoryAmount)} total spend`;
  } else if (topCategoryFromTransactions) {
    topCategoryValue = topCategoryFromTransactions;
    topCategorySubtitle = 'Highest spending volume';
    topCategoryHelper = 'Computed from recorded transactions';
  } else if (analyticsLoading) {
    topCategoryValue = '—';
    topCategorySubtitle = 'Highest spending group';
    topCategoryHelper = 'Fetching category data...';
  }

  // Middle right category summary metrics
  const displayedCategoryCount =
    totalTransactions !== null ? totalTransactions : transactions.length;
  const displayedCategoryVolume =
    totalSpending !== null ? totalSpending : (transactionsTotal !== null ? transactionsTotal : null);
  const displayedTopCategory =
    topCategoryName || topCategoryFromTransactions || null;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Page Header with Welcome Message */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Financial Overview
            </h1>
            {isSyncing && (
              <span className="inline-flex items-center space-x-1 text-xs text-blue-400 bg-blue-600/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span>Syncing API...</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Welcome to SpendWise! Here is a summary of your personal spending, category allocations, and budget progress.
          </p>
        </div>

        {/* Action Button: Triggers Expense Form Modal */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={onAddExpense}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Expense</span>
          </button>
        </div>
      </section>

      {/* Error Alert Banner */}
      {activeError && (
        <div className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-400">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Failed to synchronize financial data:</strong> {activeError}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRetryAll}
            disabled={isRetrying}
            aria-disabled={isRetrying}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold border border-red-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isRetrying ? 'Syncing...' : 'Retry Sync'}</span>
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <section
        aria-label="Financial Summary Cards"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <SummaryCard
          title="Total Expenses"
          value={totalExpensesValue}
          subtitle={totalExpensesSubtitle}
          icon={Receipt}
          badge={currencyBadge}
          helperText={totalExpensesHelper}
        />

        <SummaryCard
          title="Monthly Budget"
          value={monthlyBudgetValue}
          subtitle={monthlyBudgetSubtitle}
          icon={PiggyBank}
          badge={monthlyBudgetBadge}
          helperText={monthlyBudgetHelper}
        />

        <SummaryCard
          title="Remaining Budget"
          value={remainingBudgetValue}
          subtitle={remainingBudgetSubtitle}
          icon={Wallet}
          badge={remainingBudgetBadge}
          helperText={remainingBudgetHelper}
        />

        <SummaryCard
          title="Top Category"
          value={topCategoryValue}
          subtitle={topCategorySubtitle}
          icon={Tags}
          badge="Categories"
          helperText={topCategoryHelper}
        />
      </section>

      {/* Middle Grid: Spending Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpendingChartCard
            onNavigateToAnalytics={() => onSelectTab && onSelectTab('analytics')}
          />
        </div>

        {/* Category Budget Allocation Preview */}
        <div className="lg:col-span-1">
          <section
            aria-labelledby="category-preview-heading"
            className="h-full bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                  <Tags className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="category-preview-heading" className="text-base font-semibold text-white tracking-tight">
                    Categories
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Spending breakdown by group
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('categories')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center space-x-1"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="my-6">
              {displayedCategoryCount === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="No category data"
                  description="8 standard categories (Food & Dining, Transport, Shopping, Bills & Utilities, etc.) are configured. Category bars will appear here once expenses are logged."
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#94A3B8]">
                    Top category for active records: <strong className="text-white">{displayedTopCategory || 'General'}</strong>
                  </p>
                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span>Synchronized Records</span>
                      <strong className="text-white">{displayedCategoryCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Total Volume</span>
                      <strong className="text-white">{displayedCategoryVolume !== null ? formatCurrency(displayedCategoryVolume) : '—'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#1E293B] text-[11px] text-[#94A3B8] flex items-center justify-between">
              <span>Synchronized with API</span>
              <span>Authoritative Data Synchronized</span>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Grid: Recent Transactions Section */}
      <RecentTransactionsCard
        transactions={transactions}
        onNavigateToTransactions={() => onSelectTab && onSelectTab('transactions')}
        onAddExpense={onAddExpense}
      />
    </div>
  );
}
