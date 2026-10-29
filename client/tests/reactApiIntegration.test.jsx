import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';
import ExpenseFormModal from '../src/features/expenses/ExpenseFormModal.jsx';
import DeleteConfirmModal from '../src/features/expenses/DeleteConfirmModal.jsx';
import DashboardOverview from '../src/features/dashboard/DashboardOverview.jsx';
import ExpensesView from '../src/features/expenses/ExpensesView.jsx';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';

describe('React UI & API Integration Tests (Stage 5.4B Phase 2)', () => {
  const mockCategories = [
    {
      id: 'cat-uuid-1',
      name: 'Food & Dining',
      icon: 'utensils',
      color: '#EF4444',
      isPredefined: true
    },
    {
      id: 'cat-uuid-2',
      name: 'Transport',
      icon: 'car',
      color: '#F97316',
      isPredefined: true
    },
    {
      id: 'cat-uuid-3',
      name: 'Custom Freelance',
      icon: 'laptop',
      color: '#3B82F6',
      isPredefined: false
    }
  ];

  const mockExpenses = [
    {
      id: 'exp-uuid-101',
      title: 'Groceries at Supermarket',
      amount: 1450.5,
      date: '2026-10-25',
      paymentMethod: 'UPI',
      payment_method: 'UPI',
      categoryId: 'cat-uuid-1',
      category_id: 'cat-uuid-1',
      category: 'Food & Dining',
      categoryName: 'Food & Dining',
      categoryColor: '#EF4444',
      notes: 'Weekly fresh items'
    },
    {
      id: 'exp-uuid-102',
      title: 'Metro Pass Recharge',
      amount: 500,
      date: '2026-10-26',
      paymentMethod: 'Credit Card',
      payment_method: 'Credit Card',
      categoryId: 'cat-uuid-2',
      category_id: 'cat-uuid-2',
      category: 'Transport',
      categoryName: 'Transport',
      categoryColor: '#F97316',
      notes: ''
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Data Loading & Display in App', () => {
    it('loads and displays categories and expenses on initial mount', async () => {
      const getCategoriesSpy = vi
        .spyOn(CategoryService, 'getCategories')
        .mockResolvedValue(mockCategories);

      const listExpensesSpy = vi
        .spyOn(ExpenseService, 'listExpenses')
        .mockResolvedValue({
          items: mockExpenses,
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        });

      render(<App />);

      // Verify services were called on mount
      expect(getCategoriesSpy).toHaveBeenCalledTimes(1);
      expect(listExpensesSpy).toHaveBeenCalledTimes(1);

      // Verify dashboard displays total amount calculated from expenses (1450.50 + 500.00 = 1950.50)
      await waitFor(() => {
        expect(screen.getAllByText('₹1950.50').length).toBeGreaterThan(0);
      });

      // Verify recent transactions card shows loaded expenses
      expect(screen.getByText('Groceries at Supermarket')).toBeDefined();
      expect(screen.getByText('Metro Pass Recharge')).toBeDefined();
      expect(screen.getAllByText('Food & Dining').length).toBeGreaterThan(0);
    });

    it('handles successful empty responses by displaying empty state', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);
      vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('No transactions recorded yet')).toBeDefined();
      });

      // Total expenses should display empty placeholder '—'
      const totalExpenseCard = screen.getByLabelText('Financial Summary Cards');
      expect(within(totalExpenseCard).getAllByText('—').length).toBeGreaterThan(0);
    });

    it('displays error banner and allows retry when expense loading fails', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);
      const listExpensesSpy = vi
        .spyOn(ExpenseService, 'listExpenses')
        .mockRejectedValueOnce(new Error('Network connection refused'))
        .mockResolvedValueOnce({
          items: mockExpenses,
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        });

      render(<App />);

      // Wait for error banner
      await waitFor(() => {
        expect(screen.getByText(/Failed to synchronize financial data:/i)).toBeDefined();
        expect(screen.getByText(/Network connection refused/i)).toBeDefined();
      });

      // Click Retry Sync button
      const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
      fireEvent.click(retryBtn);

      // Verify second call succeeds and renders total
      await waitFor(() => {
        expect(screen.getAllByText('₹1950.50').length).toBeGreaterThan(0);
      });
      expect(listExpensesSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Category Selection & UUID Propagation in ExpenseFormModal', () => {
    it('populates category options with backend categories and selects category UUID', async () => {
      const handleSave = vi.fn().mockResolvedValue();
      const handleClose = vi.fn();

      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          categories={mockCategories}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      // Verify category select has all options with category IDs as values
      const categorySelect = screen.getByLabelText(/Category/i);
      expect(categorySelect.value).toBe('cat-uuid-1');

      // Change category to Custom Freelance (cat-uuid-3)
      fireEvent.change(categorySelect, { target: { value: 'cat-uuid-3' } });
      expect(categorySelect.value).toBe('cat-uuid-3');

      // Fill valid title and amount
      const titleInput = screen.getByLabelText(/Description \/ Title/i);
      const amountInput = screen.getByLabelText(/Amount/i);
      fireEvent.change(titleInput, { target: { value: 'Freelance Design Invoice' } });
      fireEvent.change(amountInput, { target: { value: '3500' } });

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /Save Expense Draft/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledTimes(1);
      });

      // Assert that category UUID was submitted, NOT the category name
      const submittedData = handleSave.mock.calls[0][0];
      expect(submittedData.categoryId).toBe('cat-uuid-3');
      expect(submittedData.category_id).toBe('cat-uuid-3');
      expect(submittedData.category).toBe('Custom Freelance');
      expect(submittedData.title).toBe('Freelance Design Invoice');
      expect(submittedData.amount).toBe(3500);

      // Modal closed on success
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('keeps modal open and displays error banner when submission fails', async () => {
      const handleSave = vi
        .fn()
        .mockRejectedValue(new Error('Database unique constraint violation'));
      const handleClose = vi.fn();

      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          categories={mockCategories}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      fireEvent.change(screen.getByLabelText(/Description \/ Title/i), {
        target: { value: 'Duplicate Transaction' }
      });
      fireEvent.change(screen.getByLabelText(/Amount/i), {
        target: { value: '120' }
      });

      const submitBtn = screen.getByRole('button', { name: /Save Expense Draft/i });
      fireEvent.click(submitBtn);

      // Verify error message is rendered
      await waitFor(() => {
        expect(
          screen.getByText(/Database unique constraint violation/i)
        ).toBeDefined();
      });

      // Verify modal did NOT close and inputs remain preserved
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/Description \/ Title/i).value).toBe(
        'Duplicate Transaction'
      );
      expect(screen.getByLabelText(/Amount/i).value).toBe('120');
    });

    it('disables submit button during mutation to prevent duplicate clicks', async () => {
      let resolvePromise;
      const deferredPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      const handleSave = vi.fn().mockReturnValue(deferredPromise);

      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          categories={mockCategories}
          onSave={handleSave}
          onClose={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/Description \/ Title/i), {
        target: { value: 'Slow Server Call' }
      });
      fireEvent.change(screen.getByLabelText(/Amount/i), {
        target: { value: '250' }
      });

      const submitBtn = screen.getByRole('button', { name: /Save Expense Draft/i });
      fireEvent.click(submitBtn);

      // While in flight, button is disabled with 'Saving...'
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saving\.\.\./i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Saving\.\.\./i }).disabled).toBe(true);
      });

      // Clicking again should not trigger additional save calls
      fireEvent.click(screen.getByRole('button', { name: /Saving\.\.\./i }));
      expect(handleSave).toHaveBeenCalledTimes(1);

      // Resolve the save
      resolvePromise();
    });
  });

  describe('Expense Mutations & Dashboard Synchronization', () => {
    it('creates a new expense via POST and refreshes authoritative dashboard state', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);

      const newExpense = {
        id: 'exp-uuid-103',
        title: 'New Bookshelf',
        amount: 2200,
        date: '2026-10-27',
        paymentMethod: 'UPI',
        payment_method: 'UPI',
        categoryId: 'cat-uuid-1',
        category_id: 'cat-uuid-1',
        category: 'Food & Dining',
        notes: ''
      };

      const listSpy = vi
        .spyOn(ExpenseService, 'listExpenses')
        .mockResolvedValueOnce({
          items: mockExpenses,
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        })
        .mockResolvedValueOnce({
          items: [newExpense, ...mockExpenses],
          pagination: { total: 3, page: 1, limit: 50, totalPages: 1 }
        });

      const createSpy = vi
        .spyOn(ExpenseService, 'createExpense')
        .mockResolvedValue(newExpense);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('₹1950.50').length).toBeGreaterThan(0);
      });

      // Open Add Expense modal
      const newExpenseBtn = screen.getByRole('button', { name: /New Expense/i });
      fireEvent.click(newExpenseBtn);

      // Fill and submit
      fireEvent.change(screen.getByLabelText(/Description \/ Title/i), {
        target: { value: 'New Bookshelf' }
      });
      fireEvent.change(screen.getByLabelText(/Amount/i), {
        target: { value: '2200' }
      });
      fireEvent.click(screen.getByRole('button', { name: /Save Expense Draft/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledTimes(1);
      });

      // Verify listExpenses was called again to refresh authoritative data
      expect(listSpy).toHaveBeenCalledTimes(2);

      // Dashboard updated with new total: 1950.50 + 2200 = 4150.50
      await waitFor(() => {
        expect(screen.getAllByText('₹4150.50').length).toBeGreaterThan(0);
      });
    });

    it('updates an existing expense via PATCH and refreshes state', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);

      const updatedExpense = {
        ...mockExpenses[1],
        amount: 650
      };

      vi.spyOn(ExpenseService, 'listExpenses')
        .mockResolvedValueOnce({
          items: mockExpenses,
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        })
        .mockResolvedValueOnce({
          items: [mockExpenses[0], updatedExpense],
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        });

      const updateSpy = vi
        .spyOn(ExpenseService, 'updateExpense')
        .mockResolvedValue(updatedExpense);

      render(<App />);

      // Switch to Transactions tab
      const transactionsNavBtn = screen.getByRole('button', { name: /Transactions/i });
      fireEvent.click(transactionsNavBtn);

      await waitFor(() => {
        expect(screen.getAllByText('Metro Pass Recharge').length).toBeGreaterThan(0);
      });

      // Click Edit on second expense
      const editBtn = screen.getByLabelText(/Edit Metro Pass Recharge/i);
      fireEvent.click(editBtn);

      // Modal opens with pre-populated values
      const amountInput = screen.getByLabelText(/Amount/i);
      expect(amountInput.value).toBe('500');

      // Change amount to 650 and submit
      fireEvent.change(amountInput, { target: { value: '650' } });
      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'exp-uuid-102',
          expect.objectContaining({
            id: 'exp-uuid-102',
            amount: 650
          })
        );
      });
    });

    it('deletes an expense via DELETE and refreshes state', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);

      vi.spyOn(ExpenseService, 'listExpenses')
        .mockResolvedValueOnce({
          items: mockExpenses,
          pagination: { total: 2, page: 1, limit: 50, totalPages: 1 }
        })
        .mockResolvedValueOnce({
          items: [mockExpenses[0]],
          pagination: { total: 1, page: 1, limit: 50, totalPages: 1 }
        });

      const deleteSpy = vi
        .spyOn(ExpenseService, 'deleteExpense')
        .mockResolvedValue({ id: 'exp-uuid-102', deleted: true });

      render(<App />);

      // Switch to Transactions tab
      fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Metro Pass Recharge').length).toBeGreaterThan(0);
      });

      // Click Delete on second expense
      const deleteBtn = screen.getByLabelText(/Delete Metro Pass Recharge/i);
      fireEvent.click(deleteBtn);

      // Confirm dialog opens
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Expense' })).toBeDefined();
      });

      // Confirm deletion
      const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Expense' });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('exp-uuid-102');
      });
    });
  });

  describe('Filtering and Stale Request Handling', () => {
    it('sends server query parameters when filters change and resets page', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);
      const listSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [mockExpenses[0]],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 }
      });

      render(<App />);

      // Switch to Transactions tab
      fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledTimes(1);
      });

      // Type in search filter
      const searchInput = screen.getByLabelText(/Search transactions/i);
      fireEvent.change(searchInput, { target: { value: 'Groceries' } });

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Groceries',
            page: 1
          })
        );
      });
    });

    it('handles missing category metadata without crashing', () => {
      const expenseWithoutCategory = {
        id: 'exp-no-cat',
        title: 'Uncategorized Spending',
        amount: 80,
        date: '2026-10-28',
        paymentMethod: 'Cash',
        categoryId: null,
        category: null,
        categoryName: null,
        categoryColor: null
      };

      render(
        <DashboardOverview
          onSelectTab={vi.fn()}
          transactions={[expenseWithoutCategory]}
          onAddExpense={vi.fn()}
        />
      );

      expect(screen.getByText('Uncategorized Spending')).toBeDefined();
      expect(screen.getAllByText('₹80.00').length).toBeGreaterThan(0);
    });
  });

  describe('Server-Side Pagination Controls', () => {
    it('disables Previous button on first page and enables Next button', () => {
      render(
        <ExpensesView
          expenses={mockExpenses}
          pagination={{ total: 60, page: 1, limit: 20, totalPages: 3 }}
          onPageChange={vi.fn()}
        />
      );

      const nav = screen.getByRole('navigation', { name: /Transactions pagination navigation/i });
      expect(nav).toBeDefined();

      const prevBtn = screen.getByRole('button', { name: /Go to previous page/i });
      const nextBtn = screen.getByRole('button', { name: /Go to next page/i });

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
      expect(nav.textContent).toContain('Page 1 of 3');
      expect(nav.textContent).toContain('Showing 1 to 2 of 60 records');
    });

    it('enables both buttons on intermediate page and disables Next on last page', () => {
      const handlePageChange = vi.fn();
      const { rerender } = render(
        <ExpensesView
          expenses={mockExpenses}
          pagination={{ total: 60, page: 2, limit: 20, totalPages: 3 }}
          onPageChange={handlePageChange}
        />
      );

      const nav = screen.getByRole('navigation', { name: /Transactions pagination navigation/i });
      const prevBtn = screen.getByRole('button', { name: /Go to previous page/i });
      const nextBtn = screen.getByRole('button', { name: /Go to next page/i });

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(false);
      expect(nav.textContent).toContain('Page 2 of 3');

      fireEvent.click(prevBtn);
      expect(handlePageChange).toHaveBeenCalledWith(1);

      fireEvent.click(nextBtn);
      expect(handlePageChange).toHaveBeenCalledWith(3);

      // Re-render on last page (Page 3 of 3)
      rerender(
        <ExpensesView
          expenses={mockExpenses}
          pagination={{ total: 60, page: 3, limit: 20, totalPages: 3 }}
          onPageChange={handlePageChange}
        />
      );

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
      expect(nav.textContent).toContain('Page 3 of 3');
    });

    it('disables both buttons for single-page result and handles empty states safely without NaN', () => {
      const { rerender } = render(
        <ExpensesView
          expenses={mockExpenses}
          pagination={{ total: 2, page: 1, limit: 20, totalPages: 1 }}
          onPageChange={vi.fn()}
        />
      );

      const nav = screen.getByRole('navigation', { name: /Transactions pagination navigation/i });
      let prevBtn = screen.getByRole('button', { name: /Go to previous page/i });
      let nextBtn = screen.getByRole('button', { name: /Go to next page/i });

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
      expect(nav.textContent).toContain('Page 1 of 1');

      // Empty result test
      rerender(
        <ExpensesView
          expenses={[]}
          pagination={{ total: 0, page: 0, limit: 20, totalPages: 0 }}
          onPageChange={vi.fn()}
        />
      );

      prevBtn = screen.getByRole('button', { name: /Go to previous page/i });
      nextBtn = screen.getByRole('button', { name: /Go to next page/i });

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
      expect(nav.textContent).toContain('No transactions to paginate');
      expect(nav.textContent).toContain('Page 1 of 1');
      expect(nav.textContent).not.toContain('NaN');
    });

    it('disables pagination buttons when loading is in progress', () => {
      render(
        <ExpensesView
          expenses={mockExpenses}
          pagination={{ total: 60, page: 2, limit: 20, totalPages: 3 }}
          isLoading={true}
          onPageChange={vi.fn()}
        />
      );

      const prevBtn = screen.getByRole('button', { name: /Go to previous page/i });
      const nextBtn = screen.getByRole('button', { name: /Go to next page/i });

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
    });

    it('preserves active search, category, payment method, and sort when changing pages in App', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);
      const listSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: mockExpenses,
        pagination: { total: 40, page: 1, limit: 20, totalPages: 2 }
      });

      render(<App />);

      // Switch to Transactions tab
      fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledTimes(1);
      });

      // Filter by category
      const categorySelect = screen.getByLabelText('Category');
      fireEvent.change(categorySelect, { target: { value: 'cat-uuid-1' } });

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            categoryId: 'cat-uuid-1',
            page: 1
          })
        );
      });

      // Now click Next page button
      const nextBtn = screen.getByRole('button', { name: /Go to next page/i });
      expect(nextBtn.disabled).toBe(false);
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            categoryId: 'cat-uuid-1',
            page: 2
          })
        );
      });
    });
  });
});
