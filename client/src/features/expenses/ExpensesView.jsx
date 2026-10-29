import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Receipt,
  IndianRupee,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ExpenseFilters from './ExpenseFilters.jsx';
import ExpenseTable from './ExpenseTable.jsx';
import { PREDEFINED_CATEGORIES } from './constants.js';

export default function ExpensesView({
  expenses = [],
  categories = PREDEFINED_CATEGORIES,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  isLoading = false,
  error = null,
  onRetry = null,
  pagination = null,
  onFilterChange = null,
  onPageChange = null,
  activeFilters = null
}) {
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState(activeFilters?.search || '');
  const [selectedCategory, setSelectedCategory] = useState(activeFilters?.categoryId || 'ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(activeFilters?.paymentMethod || 'ALL');
  const [selectedSort, setSelectedSort] = useState(activeFilters?.sort || 'date-desc');

  // Sync state if activeFilters changes from parent
  useEffect(() => {
    if (activeFilters) {
      if (activeFilters.search !== undefined) setSearchQuery(activeFilters.search);
      if (activeFilters.categoryId !== undefined) setSelectedCategory(activeFilters.categoryId);
      if (activeFilters.paymentMethod !== undefined) setSelectedPaymentMethod(activeFilters.paymentMethod);
      if (activeFilters.sort !== undefined) setSelectedSort(activeFilters.sort);
    }
  }, [activeFilters]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedPaymentMethod !== 'ALL' ||
    selectedSort !== 'date-desc'
  );

  // Debounced/Direct filter change propagation to parent
  function notifyFilterChange(updates) {
    if (onFilterChange) {
      onFilterChange({
        search: updates.search !== undefined ? updates.search : searchQuery,
        categoryId: updates.categoryId !== undefined ? updates.categoryId : selectedCategory,
        paymentMethod: updates.paymentMethod !== undefined ? updates.paymentMethod : selectedPaymentMethod,
        sort: updates.sort !== undefined ? updates.sort : selectedSort,
        page: 1 // Reset to page 1 on filter changes
      });
    }
  }

  function handleSearchChange(val) {
    setSearchQuery(val);
    notifyFilterChange({ search: val });
  }

  function handleCategoryChange(val) {
    setSelectedCategory(val);
    notifyFilterChange({ categoryId: val });
  }

  function handlePaymentMethodChange(val) {
    setSelectedPaymentMethod(val);
    notifyFilterChange({ paymentMethod: val });
  }

  function handleSortChange(val) {
    setSelectedSort(val);
    notifyFilterChange({ sort: val });
  }

  function handleResetFilters() {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedPaymentMethod('ALL');
    setSelectedSort('date-desc');
    if (onFilterChange) {
      onFilterChange({
        search: '',
        categoryId: 'ALL',
        paymentMethod: 'ALL',
        sort: 'date-desc',
        page: 1
      });
    }
  }

  // Fallback in-memory filter and sort logic for standalone or un-wired usage
  const localFilteredExpenses = useMemo(() => {
    let result = [...expenses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (exp) =>
          (exp.title && exp.title.toLowerCase().includes(q)) ||
          (exp.notes && exp.notes.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'ALL') {
      result = result.filter(
        (exp) =>
          exp.categoryId === selectedCategory ||
          exp.category_id === selectedCategory ||
          exp.category === selectedCategory ||
          exp.categoryName === selectedCategory
      );
    }

    if (selectedPaymentMethod !== 'ALL') {
      result = result.filter(
        (exp) =>
          (exp.paymentMethod || exp.payment_method) === selectedPaymentMethod
      );
    }

    result.sort((a, b) => {
      switch (selectedSort) {
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount-desc':
          return Number(b.amount) - Number(a.amount);
        case 'amount-asc':
          return Number(a.amount) - Number(b.amount);
        case 'date-desc':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return result;
  }, [expenses, searchQuery, selectedCategory, selectedPaymentMethod, selectedSort]);

  // When onFilterChange is provided, the parent passes server-filtered expenses.
  // Otherwise, use localFilteredExpenses.
  const displayExpenses = onFilterChange ? expenses : localFilteredExpenses;

  // Compute total of current visible records
  const totalFilteredAmount = useMemo(() => {
    return displayExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [displayExpenses]);

  // Pagination metadata & safe bounds
  const totalItems = Number(pagination?.total) || 0;
  const currentPage = Math.max(1, Number(pagination?.page) || 1);
  const limit = Math.max(1, Number(pagination?.limit) || 20);
  const totalPages = Math.max(
    1,
    Number(pagination?.totalPages) || (totalItems > 0 ? Math.ceil(totalItems / limit) : 1)
  );
  const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endRecord =
    totalItems === 0
      ? 0
      : Math.min(totalItems, (currentPage - 1) * limit + displayExpenses.length);
  const isPrevDisabled = currentPage <= 1 || isLoading;
  const isNextDisabled = currentPage >= totalPages || totalItems === 0 || isLoading;

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages || isLoading) return;
    if (onPageChange) {
      onPageChange(newPage);
    } else if (onFilterChange) {
      onFilterChange({
        search: searchQuery,
        categoryId: selectedCategory,
        paymentMethod: selectedPaymentMethod,
        sort: selectedSort,
        page: newPage
      });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Transactions
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
            Record, filter, and organize your personal expenses with category categorization and payment methods.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={onAddExpense}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Expense</span>
          </button>
        </div>
      </section>

      {/* Error Notification Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-400">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Failed to load transactions:</strong> {error}
            </span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold border border-red-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry Request</span>
            </button>
          )}
        </div>
      )}

      {/* Summary metric bar (if records exist) */}
      {displayExpenses.length > 0 && (
        <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <Receipt className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span>
              {pagination && totalItems > displayExpenses.length ? (
                <>
                  Showing <strong className="text-white">{displayExpenses.length}</strong> of{' '}
                  <strong className="text-white">{totalItems}</strong> total records (Page{' '}
                  <strong className="text-white">{currentPage}</strong> of{' '}
                  <strong className="text-white">{totalPages}</strong>)
                </>
              ) : (
                <>
                  Showing <strong className="text-white">{displayExpenses.length}</strong> of{' '}
                  <strong className="text-white">{totalItems > 0 ? totalItems : displayExpenses.length}</strong> total records
                </>
              )}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-[#94A3B8]">Visible Total:</span>
            <span className="font-bold text-white flex items-center">
              <IndianRupee className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              <span>{totalFilteredAmount.toFixed(2)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Filters & Search Component */}
      <ExpenseFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        selectedPaymentMethod={selectedPaymentMethod}
        onPaymentMethodChange={handlePaymentMethodChange}
        selectedSort={selectedSort}
        onSortChange={handleSortChange}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        categories={categories}
      />

      {/* Transactions Table & Mobile Cards */}
      <ExpenseTable
        expenses={displayExpenses}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        onAddExpense={onAddExpense}
      />

      {/* Server-Side Pagination Controls */}
      <nav
        aria-label="Transactions pagination navigation"
        className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]"
      >
        <div className="flex items-center space-x-2">
          {totalItems > 0 ? (
            <span>
              Showing <strong className="text-white">{startRecord}</strong> to{' '}
              <strong className="text-white">{endRecord}</strong> of{' '}
              <strong className="text-white">{totalItems}</strong> records
            </span>
          ) : (
            <span>No transactions to paginate</span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={isPrevDisabled}
            aria-label="Go to previous page"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-[#F8FAFC] text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0F172A]"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <span
            aria-live="polite"
            aria-atomic="true"
            className="px-2 text-xs font-medium text-[#94A3B8]"
          >
            Page <strong className="text-white">{currentPage}</strong> of{' '}
            <strong className="text-white">{totalPages}</strong>
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={isNextDisabled}
            aria-label="Go to next page"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-[#F8FAFC] text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0F172A]"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
