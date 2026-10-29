import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import AnalyticsSummaryCards from './AnalyticsSummaryCards.jsx';
import CategoryDonutChart from './CategoryDonutChart.jsx';
import PaymentMethodDistribution from './PaymentMethodDistribution.jsx';
import DailySpendingTrendChart from './DailySpendingTrendChart.jsx';
import { AnalyticsService } from '../../services/analytics.service.js';
import { MONTH_NAMES, AVAILABLE_YEARS } from '../budgets/BudgetFormModal.jsx';

export const MIN_YEAR = 2024;
export const MIN_MONTH = 1;
export const MAX_YEAR = 2030;
export const MAX_MONTH = 12;

export default function AnalyticsView({ initialMonth = 10, initialYear = 2026 }) {
  // Period Selection State (Clamped to supported boundary: Jan 2024 - Dec 2030)
  const safeInitialMonth = Math.min(12, Math.max(1, Number(initialMonth) || 10));
  const safeInitialYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(initialYear) || 2026));

  const [selectedMonth, setSelectedMonth] = useState(safeInitialMonth);
  const [selectedYear, setSelectedYear] = useState(safeInitialYear);

  // Data, Loading, and Error State
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Concurrency and Component Lifecycle References
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load analytics for the selected period with request sequencing and unmount protection
  const loadAnalytics = useCallback(async (m = selectedMonth, y = selectedYear) => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await AnalyticsService.getMonthlySummary({ month: m, year: y });
      if (isMountedRef.current && reqId === requestIdRef.current) {
        setAnalytics(data);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current && reqId === requestIdRef.current) {
        setError(err.message || 'Failed to load analytics data. Please check your connection.');
        setIsLoading(false);
      }
    }
  }, [selectedMonth, selectedYear]);

  // Load on mount and when period changes
  useEffect(() => {
    loadAnalytics(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, loadAnalytics]);

  // Boundary Checks
  const isMinPeriod = selectedYear <= MIN_YEAR && selectedMonth <= MIN_MONTH;
  const isMaxPeriod = selectedYear >= MAX_YEAR && selectedMonth >= MAX_MONTH;

  // Period navigation helpers with strict boundary guards
  function handlePrevMonth() {
    if (selectedYear <= MIN_YEAR && selectedMonth <= MIN_MONTH) {
      return;
    }
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => Math.max(MIN_YEAR, prev - 1));
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  }

  function handleNextMonth() {
    if (selectedYear >= MAX_YEAR && selectedMonth >= MAX_MONTH) {
      return;
    }
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => Math.min(MAX_YEAR, prev + 1));
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  }

  function handleMonthChange(e) {
    const val = Number(e.target.value);
    if (Number.isInteger(val) && val >= 1 && val <= 12) {
      setSelectedMonth(val);
    }
  }

  function handleYearChange(e) {
    const val = Number(e.target.value);
    if (Number.isInteger(val) && val >= MIN_YEAR && val <= MAX_YEAR) {
      setSelectedYear(val);
    }
  }

  const periodLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  const summary = analytics?.summary || {};
  const byCategory = analytics?.byCategory || [];
  const byPaymentMethod = analytics?.byPaymentMethod || [];
  const dailyTrend = analytics?.dailyTrend || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Analytics & Insights
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] font-medium">
              INR (₹)
            </span>
            {isLoading && (
              <span className="inline-flex items-center space-x-1 text-xs text-blue-400 bg-blue-600/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span>Syncing Analytics...</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Database-aggregated spending analytics, category distributions, payment breakdowns, and daily spending velocity.
          </p>
        </div>
      </section>

      {/* Period Navigation Bar */}
      <section
        aria-label="Analytics Period Navigation"
        className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Selected Period
            </span>
            <span className="text-sm font-bold text-white tracking-tight">
              {periodLabel}
            </span>
          </div>
        </div>

        {/* Stepper & Selectors */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            disabled={isLoading || isMinPeriod}
            className="p-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            aria-label="Select month"
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] text-white font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1} className="bg-[#0F172A] text-white">
                {name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={handleYearChange}
            aria-label="Select year"
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] text-white font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y} className="bg-[#0F172A] text-white">
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            disabled={isLoading || isMaxPeriod}
            className="p-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Error Alert Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-400"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Failed to load analytics:</strong> {error}
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadAnalytics(selectedMonth, selectedYear)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold border border-red-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Request</span>
          </button>
        </div>
      )}

      {/* 1. Metric Summary Cards */}
      <AnalyticsSummaryCards summary={summary} periodLabel={periodLabel} />

      {/* 2. Middle Grid: Category Donut & Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDonutChart
          byCategory={byCategory}
          totalSpending={summary.totalSpending || 0}
        />
        <PaymentMethodDistribution
          byPaymentMethod={byPaymentMethod}
          totalSpending={summary.totalSpending || 0}
        />
      </div>

      {/* 3. Bottom Row: Chronological Daily Spending Trend */}
      <DailySpendingTrendChart
        dailyTrend={dailyTrend}
        totalSpending={summary.totalSpending || 0}
      />
    </div>
  );
}
