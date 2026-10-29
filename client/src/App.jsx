import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import Sidebar from './components/layout/Sidebar.jsx';
import Header from './components/layout/Header.jsx';
import MobileNav from './components/layout/MobileNav.jsx';
import DashboardOverview from './features/dashboard/DashboardOverview.jsx';
import ExpensesView from './features/expenses/ExpensesView.jsx';
import CategoriesView from './features/categories/CategoriesView.jsx';
import BudgetsView from './features/budgets/BudgetsView.jsx';
import ExpenseFormModal from './features/expenses/ExpenseFormModal.jsx';
import DeleteConfirmModal from './features/expenses/DeleteConfirmModal.jsx';
import EmptyState from './components/common/EmptyState.jsx';
import AuthView from './features/auth/AuthView.jsx';
import { Tags, PiggyBank, BarChart3, ArrowLeft, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { CategoryService } from './services/category.service.js';
import { ExpenseService } from './services/expense.service.js';
import { useAuth } from './context/AuthContext.jsx';

// Code-split heavy charting analytics view with dynamic import
const AnalyticsView = lazy(() => import('./features/analytics/AnalyticsView.jsx'));

function ViewLoadingFallback({ label = 'Loading analytics...' }) {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 space-y-4"
      aria-busy="true"
      aria-label={label}
    >
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-xs text-[#94A3B8] font-medium">{label}</span>
    </div>
  );
}

export default function App() {
  const { status, user, error: authError, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Categories API State
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  // Expenses API State
  const [expenses, setExpenses] = useState([]);
  const [expensesPagination, setExpensesPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1
  });
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState(null);

  // Active Query / Filter Parameters
  const [activeFilters, setActiveFilters] = useState({
    search: '',
    categoryId: 'ALL',
    paymentMethod: 'ALL',
    sort: 'date-desc',
    page: 1,
    limit: 50
  });

  // Modal Management State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Concurrency & Lifecycle References
  const isMountedRef = useRef(true);
  const expenseRequestIdRef = useRef(0);
  const categoryRequestIdRef = useRef(0);
  const authStatusRef = useRef(status);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch Categories strictly when authenticated
  const loadCategories = useCallback(async () => {
    if (authStatusRef.current !== 'authenticated') {
      return;
    }
    const reqId = ++categoryRequestIdRef.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await CategoryService.getCategories();
      if (
        isMountedRef.current &&
        reqId === categoryRequestIdRef.current &&
        authStatusRef.current === 'authenticated'
      ) {
        setCategories(data);
        setCategoriesLoading(false);
      }
    } catch (err) {
      if (
        isMountedRef.current &&
        reqId === categoryRequestIdRef.current &&
        authStatusRef.current === 'authenticated'
      ) {
        setCategoriesError(err.message || 'Failed to load categories.');
        setCategoriesLoading(false);
      }
    }
  }, []);

  // Fetch Expenses with active filters and sequence numbering strictly when authenticated
  const loadExpenses = useCallback(async (filtersToApply) => {
    if (authStatusRef.current !== 'authenticated') {
      return;
    }
    const reqId = ++expenseRequestIdRef.current;
    setExpensesLoading(true);
    setExpensesError(null);

    try {
      const result = await ExpenseService.listExpenses(filtersToApply);
      if (
        isMountedRef.current &&
        reqId === expenseRequestIdRef.current &&
        authStatusRef.current === 'authenticated'
      ) {
        setExpenses(result.items);
        setExpensesPagination(result.pagination);
        setExpensesLoading(false);
      }
    } catch (err) {
      if (
        isMountedRef.current &&
        reqId === expenseRequestIdRef.current &&
        authStatusRef.current === 'authenticated'
      ) {
        setExpensesError(err.message || 'Failed to load transactions.');
        setExpensesLoading(false);
      }
    }
  }, []);

  // Auth State Synchronization:
  // - authenticated: initiate authoritative data queries
  // - unauthenticated/loading: invalidate in-flight requests and immediately clear financial state
  useEffect(() => {
    authStatusRef.current = status;
    if (status === 'authenticated') {
      loadCategories();
      loadExpenses(activeFilters);
    } else {
      // Invalidate any in-flight requests
      categoryRequestIdRef.current++;
      expenseRequestIdRef.current++;
      // Purge financial state so seeded or old data is never shown under unauthenticated identity
      setCategories([]);
      setCategoriesLoading(false);
      setCategoriesError(null);
      setExpenses([]);
      setExpensesPagination({
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 1
      });
      setExpensesLoading(false);
      setExpensesError(null);
    }
  }, [status, loadCategories, loadExpenses]);

  // Refresh handler for error banners
  const handleRetry = useCallback(() => {
    if (authStatusRef.current === 'authenticated') {
      loadCategories();
      loadExpenses(activeFilters);
    }
  }, [loadCategories, loadExpenses, activeFilters]);

  // Filter change handler from ExpensesView
  const handleFilterChange = useCallback(
    (newFilters) => {
      setActiveFilters((prev) => {
        const updated = { ...prev, ...newFilters };
        if (authStatusRef.current === 'authenticated') {
          loadExpenses(updated);
        }
        return updated;
      });
    },
    [loadExpenses]
  );

  // Dedicated Page change handler for server-side pagination
  const handlePageChange = useCallback(
    (newPage) => {
      setActiveFilters((prev) => {
        const updated = { ...prev, page: newPage };
        if (authStatusRef.current === 'authenticated') {
          loadExpenses(updated);
        }
        return updated;
      });
    },
    [loadExpenses]
  );

  // Modal Handlers
  function handleAddExpense() {
    if (authStatusRef.current !== 'authenticated') return;
    setExpenseToEdit(null);
    setIsFormModalOpen(true);
  }

  function handleEditExpense(expense) {
    if (authStatusRef.current !== 'authenticated') return;
    setExpenseToEdit(expense);
    setIsFormModalOpen(true);
  }

  async function handleSaveExpense(expenseData) {
    if (authStatusRef.current !== 'authenticated') return;
    if (expenseData.id) {
      // Update existing expense via PATCH
      await ExpenseService.updateExpense(expenseData.id, expenseData);
    } else {
      // Create new expense via POST
      await ExpenseService.createExpense(expenseData);
    }
    // Refresh authoritative expense state
    await loadExpenses(activeFilters);
  }

  function handleDeleteExpense(expense) {
    if (authStatusRef.current !== 'authenticated') return;
    setExpenseToDelete(expense);
    setIsDeleteModalOpen(true);
  }

  async function handleConfirmDelete(expenseId) {
    if (authStatusRef.current !== 'authenticated') return;
    await ExpenseService.deleteExpense(expenseId);
    // Refresh authoritative expense state
    await loadExpenses(activeFilters);
  }

  // Category Creation Handler
  async function handleCreateCategory(categoryData) {
    if (authStatusRef.current !== 'authenticated') return null;
    const created = await CategoryService.createCategory(categoryData);
    // Refresh authoritative category state
    await loadCategories();
    return created;
  }

  if (status === 'loading') {
    return (
      <div
        className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex items-center justify-center p-4"
        aria-busy="true"
        aria-label="Verifying authentication session"
      >
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#94A3B8]">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex selection:bg-blue-600 selection:text-white">
      {/* Desktop Fixed Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Mobile Drawer Navigation */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area (Offset by desktop sidebar width 16rem = 64) */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen min-w-0">
        {/* Sticky Header */}
        <Header
          activeTab={activeTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Dynamic Main Workspace Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {status !== 'authenticated' ? (
            <AuthView />
          ) : (
            <>
              {activeTab === 'overview' && (
                <DashboardOverview
                  onSelectTab={setActiveTab}
                  transactions={expenses}
                  onAddExpense={handleAddExpense}
                  isLoading={expensesLoading}
                  error={expensesError}
                  onRetry={handleRetry}
                  pagination={expensesPagination}
                />
              )}

              {activeTab === 'transactions' && (
                <ExpensesView
                  expenses={expenses}
                  categories={categories}
                  onAddExpense={handleAddExpense}
                  onEditExpense={handleEditExpense}
                  onDeleteExpense={handleDeleteExpense}
                  isLoading={expensesLoading}
                  error={expensesError}
                  onRetry={handleRetry}
                  pagination={expensesPagination}
                  onFilterChange={handleFilterChange}
                  onPageChange={handlePageChange}
                  activeFilters={activeFilters}
                />
              )}

              {activeTab === 'categories' && (
                <CategoriesView
                  categories={categories}
                  isLoading={categoriesLoading}
                  error={categoriesError}
                  onRetry={loadCategories}
                  onSaveCategory={handleCreateCategory}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView categories={categories} />
              )}

              {activeTab === 'analytics' && (
                <Suspense fallback={<ViewLoadingFallback label="Loading analytics..." />}>
                  <AnalyticsView />
                </Suspense>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1E293B] bg-[#0F172A] py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-[#94A3B8]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>&copy; SpendWise &bull; Personal Expense Tracker</p>
            <p className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
              <span>API Integration Active</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Reusable Expense Form Modal (Create / Edit) */}
      <ExpenseFormModal
        isOpen={isFormModalOpen}
        expenseToEdit={expenseToEdit}
        categories={categories}
        onSave={handleSaveExpense}
        onClose={() => {
          setIsFormModalOpen(false);
          setExpenseToEdit(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        expense={expenseToDelete}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setExpenseToDelete(null);
        }}
      />
    </div>
  );
}
