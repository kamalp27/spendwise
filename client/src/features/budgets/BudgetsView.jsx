import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  PiggyBank,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  X,
  Tags
} from 'lucide-react';
import BudgetOverviewSummary from './BudgetOverviewSummary.jsx';
import BudgetCard from './BudgetCard.jsx';
import BudgetFormModal, { MONTH_NAMES, AVAILABLE_YEARS } from './BudgetFormModal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { BudgetService } from '../../services/budget.service.js';

export default function BudgetsView({
  categories = [],
  onSaveBudget = null
}) {
  // Period Selection State (Defaulting to October 2026)
  const [selectedMonth, setSelectedMonth] = useState(10);
  const [selectedYear, setSelectedYear] = useState(2026);

  // Budget Data State
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState('overall');

  // Load budgets for selected period
  const loadBudgets = useCallback(async (m = selectedMonth, y = selectedYear) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await BudgetService.listBudgets({ month: m, year: y });
      setBudgets(data);
      setIsLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load budgets. Please check your connection.');
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Load on mount and whenever selected period changes
  useEffect(() => {
    loadBudgets(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, loadBudgets]);

  // Partition into Overall Budget and Category Budgets
  const { overallBudget, categoryBudgets } = useMemo(() => {
    let overall = null;
    const catBudgets = [];

    for (const b of budgets) {
      if (b.isOverall || b.is_overall || b.category_id === null) {
        overall = b;
      } else {
        catBudgets.push(b);
      }
    }

    return { overallBudget: overall, categoryBudgets: catBudgets };
  }, [budgets]);

  // Period navigation helpers
  function handlePrevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  }

  function handleNextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  }

  function handleOpenCreateModal(type = 'overall') {
    setModalInitialType(type);
    setIsModalOpen(true);
  }

  async function handleSaveBudget(budgetData) {
    let created;
    if (onSaveBudget) {
      created = await onSaveBudget(budgetData);
    } else {
      created = await BudgetService.createBudget(budgetData);
    }

    // Refresh budgets for current period
    await loadBudgets(selectedMonth, selectedYear);

    const periodName = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    const budgetLabel = budgetData.categoryId
      ? 'Category budget'
      : 'Overall monthly budget';

    setSuccessMessage(`${budgetLabel} for ${periodName} was created successfully.`);
    return created;
  }

  const periodLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Budgets
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] font-medium">
              INR (₹)
            </span>
            {isLoading && (
              <span className="inline-flex items-center space-x-1 text-xs text-blue-400 bg-blue-600/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span>Syncing...</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Set monthly spending ceilings and track actual spending against financial targets in real time.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleOpenCreateModal('overall')}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Budget</span>
          </button>
        </div>
      </section>

      {/* Period Selection Controls */}
      <section
        aria-label="Budget Period Navigation"
        className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] text-[#94A3B8] block">Selected Period</span>
            <span className="text-sm font-bold text-white tracking-tight">
              {periodLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Previous Month Stepper */}
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            aria-label="Select budget month"
            className="px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1} className="bg-[#0F172A] text-white">
                {name}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="Select budget year"
            className="px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y} className="bg-[#0F172A] text-white">
                {y}
              </option>
            ))}
          </select>

          {/* Next Month Stepper */}
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F19] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs text-emerald-400"
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Success:</strong> {successMessage}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded text-emerald-400 hover:text-white hover:bg-emerald-600/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-400"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Failed to load budgets:</strong> {error}
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadBudgets(selectedMonth, selectedYear)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold border border-red-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Request</span>
          </button>
        </div>
      )}

      {/* Empty State when zero budgets exist for this month */}
      {!isLoading && budgets.length === 0 && !error && (
        <EmptyState
          icon={PiggyBank}
          title={`No budgets set for ${periodLabel}`}
          description="Create an overall monthly budget or specific category caps to monitor your spending and prevent budget overruns."
          actionLabel="Create Budget"
          onAction={() => handleOpenCreateModal('overall')}
          className="my-4"
        />
      )}

      {/* When at least one budget exists */}
      {budgets.length > 0 && (
        <div className="space-y-6">
          {/* Overall Monthly Budget Hero Summary */}
          <BudgetOverviewSummary
            overallBudget={overallBudget}
            periodLabel={periodLabel}
            onAddOverallBudget={() => handleOpenCreateModal('overall')}
          />

          {/* Category Budgets Grid */}
          <section aria-labelledby="category-budgets-heading" className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center space-x-2">
                <h2 id="category-budgets-heading" className="text-base font-bold text-white tracking-tight">
                  Category Spending Limits
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30">
                  {categoryBudgets.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateModal('category')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded px-1"
              >
                + Add Category Budget
              </button>
            </div>

            {categoryBudgets.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0F172A] border border-dashed border-[#1E293B] text-center">
                <p className="text-xs text-[#94A3B8]">
                  No category-specific caps set for {periodLabel}. Overall monthly budget is actively tracking your combined spending.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('category')}
                  className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-xs border border-blue-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Category Budget</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBudgets.map((b) => (
                  <BudgetCard key={b.id} budget={b} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create Budget Modal */}
      <BudgetFormModal
        isOpen={isModalOpen}
        onSave={handleSaveBudget}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
        initialType={modalInitialType}
      />
    </div>
  );
}
