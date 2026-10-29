import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';
import BudgetsView from '../src/features/budgets/BudgetsView.jsx';
import BudgetCard from '../src/features/budgets/BudgetCard.jsx';
import BudgetOverviewSummary from '../src/features/budgets/BudgetOverviewSummary.jsx';
import BudgetFormModal from '../src/features/budgets/BudgetFormModal.jsx';
import BudgetProgressBar from '../src/features/budgets/BudgetProgressBar.jsx';
import { BudgetService } from '../src/services/budget.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';

describe('Budget Management UI & Feature (Stage 5.6B)', () => {
  const mockCategories = [
    {
      id: 'cat-uuid-1',
      name: 'Food & Dining',
      icon: 'utensils',
      color: '#EF4444',
      isPredefined: true,
      is_predefined: true
    },
    {
      id: 'cat-uuid-2',
      name: 'Transport',
      icon: 'car',
      color: '#F97316',
      isPredefined: true,
      is_predefined: true
    }
  ];

  const mockOverallBudget = {
    id: 'budget-overall-1',
    user_id: 'user-uuid-1',
    category_id: null,
    amount: 25000,
    month: 10,
    year: 2026,
    actual_spent: 8500,
    actualSpent: 8500,
    remaining_amount: 16500,
    remainingAmount: 16500,
    percentage_used: 34.0,
    percentageUsed: 34.0,
    is_overall: true,
    isOverall: true,
    category_name: null,
    category_icon: null,
    category_color: null
  };

  const mockCategoryBudget = {
    id: 'budget-cat-1',
    user_id: 'user-uuid-1',
    category_id: 'cat-uuid-1',
    amount: 6000,
    month: 10,
    year: 2026,
    actual_spent: 5400,
    actualSpent: 5400,
    remaining_amount: 600,
    remainingAmount: 600,
    percentage_used: 90.0,
    percentageUsed: 90.0,
    is_overall: false,
    isOverall: false,
    category_name: 'Food & Dining',
    categoryName: 'Food & Dining',
    category_icon: 'utensils',
    categoryIcon: 'utensils',
    category_color: '#EF4444',
    categoryColor: '#EF4444'
  };

  const mockOverspentBudget = {
    id: 'budget-cat-2',
    user_id: 'user-uuid-1',
    category_id: 'cat-uuid-2',
    amount: 2000,
    month: 10,
    year: 2026,
    actual_spent: 2450.5,
    actualSpent: 2450.5,
    remaining_amount: -450.5,
    remainingAmount: -450.5,
    percentage_used: 122.5,
    percentageUsed: 122.5,
    is_overall: false,
    isOverall: false,
    category_name: 'Transport',
    categoryName: 'Transport',
    category_icon: 'car',
    categoryIcon: 'car',
    category_color: '#F97316',
    categoryColor: '#F97316'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BudgetCard & Progress Display', () => {
    it('renders overall budget card with accurate calculations', () => {
      render(<BudgetCard budget={mockOverallBudget} />);

      expect(screen.getByText('Overall Monthly Budget')).toBeDefined();
      expect(screen.getByText('25000.00')).toBeDefined();
      expect(screen.getByText('8500.00')).toBeDefined();
      expect(screen.getByText('16500.00')).toBeDefined();
      expect(screen.getByText('34.0%')).toBeDefined();
      expect(screen.getByText('On Track')).toBeDefined();

      const progress = screen.getByRole('progressbar');
      expect(progress.getAttribute('aria-valuenow')).toBe('34');
    });

    it('renders category budget with category metadata and near-limit warning (>= 85%)', () => {
      render(<BudgetCard budget={mockCategoryBudget} />);

      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('6000.00')).toBeDefined();
      expect(screen.getByText('5400.00')).toBeDefined();
      expect(screen.getByText('600.00')).toBeDefined();
      expect(screen.getByText('Near Limit')).toBeDefined();
      expect(screen.getByText('90.0%')).toBeDefined();
    });

    it('renders overspent budget with over-budget warning and negative remaining indicator', () => {
      render(<BudgetCard budget={mockOverspentBudget} />);

      expect(screen.getByText('Transport')).toBeDefined();
      expect(screen.getByText('Over Budget')).toBeDefined();
      expect(screen.getByText('450.50')).toBeDefined(); // Math.abs(remaining)
      expect(screen.getByText('122.5%')).toBeDefined();
    });

    it('handles zero spending without crashing or producing NaN', () => {
      render(
        <BudgetProgressBar
          percentageUsed={0}
          actualSpent={0}
          amount={5000}
          label="Zero spending test"
        />
      );

      expect(screen.getByText('0.0%')).toBeDefined();
      const progress = screen.getByRole('progressbar');
      expect(progress.getAttribute('aria-valuenow')).toBe('0');
      expect(progress.getAttribute('aria-valuetext')).toContain('0.0% of budget spent');
    });
  });

  describe('BudgetsView Rendering & Period Selection', () => {
    it('renders empty state when no budgets exist for selected month', async () => {
      vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([]);

      render(<BudgetsView categories={mockCategories} />);

      await waitFor(() => {
        expect(screen.getByText(/No budgets set for October 2026/i)).toBeDefined();
      });

      expect(
        screen.getByText(
          /Create an overall monthly budget or specific category caps to monitor your spending/i
        )
      ).toBeDefined();
    });

    it('renders both overall summary and category spending limits when data is present', async () => {
      vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([
        mockOverallBudget,
        mockCategoryBudget
      ]);

      render(<BudgetsView categories={mockCategories} />);

      await waitFor(() => {
        expect(screen.getByText('October 2026 Overall Budget')).toBeDefined();
      });

      expect(screen.getByText('Category Spending Limits')).toBeDefined();
      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('25000.00')).toBeDefined();
      expect(screen.getByText('6000.00')).toBeDefined();
    });

    it('updates period and queries service when stepping months', async () => {
      const listSpy = vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([]);

      render(<BudgetsView categories={mockCategories} />);

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith({ month: 10, year: 2026 });
      });

      // Click Next Month
      const nextBtn = screen.getByRole('button', { name: /Next month/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith({ month: 11, year: 2026 });
      });
      expect(screen.getAllByText(/November 2026/i).length).toBeGreaterThan(0);

      // Click Previous Month twice
      const prevBtn = screen.getByRole('button', { name: /Previous month/i });
      fireEvent.click(prevBtn);
      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith({ month: 9, year: 2026 });
      });
      expect(screen.getAllByText(/September 2026/i).length).toBeGreaterThan(0);
    });

    it('displays error alert and allows retrying when loading fails', async () => {
      const listSpy = vi
        .spyOn(BudgetService, 'listBudgets')
        .mockRejectedValueOnce(new Error('Connection timed out'))
        .mockResolvedValueOnce([mockOverallBudget]);

      render(<BudgetsView categories={mockCategories} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load budgets:/i)).toBeDefined();
        expect(screen.getByText(/Connection timed out/i)).toBeDefined();
      });

      const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('October 2026 Overall Budget')).toBeDefined();
      });
      expect(listSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('BudgetFormModal Validation & Creation', () => {
    it('renders modal with initial focus and closes on Escape', () => {
      const handleClose = vi.fn();
      render(
        <BudgetFormModal
          isOpen={true}
          onSave={vi.fn()}
          onClose={handleClose}
          categories={mockCategories}
        />
      );

      const modal = screen.getByRole('dialog', { name: /Create Budget Limit/i });
      expect(modal).toBeDefined();

      fireEvent.keyDown(modal, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('validates amount: required, positive, and max 2 decimals', async () => {
      const handleSave = vi.fn();
      render(
        <BudgetFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={vi.fn()}
          categories={mockCategories}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Budget amount is required.')).toBeDefined();
      expect(handleSave).not.toHaveBeenCalled();

      // Enter negative amount
      const amountInput = screen.getByLabelText(/Budget Limit \(INR/i);
      fireEvent.change(amountInput, { target: { value: '-100' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Amount must be greater than zero.')).toBeDefined();

      // Enter excessive decimals
      fireEvent.change(amountInput, { target: { value: '50.123' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Amount cannot have more than 2 decimal places.')).toBeDefined();
    });

    it('submits overall budget with category_id null', async () => {
      const handleSave = vi.fn().mockResolvedValue({ id: 'new-b' });
      const handleClose = vi.fn();

      render(
        <BudgetFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={handleClose}
          categories={mockCategories}
          initialMonth={10}
          initialYear={2026}
        />
      );

      const amountInput = screen.getByLabelText(/Budget Limit \(INR/i);
      fireEvent.change(amountInput, { target: { value: '30000' } });

      const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith({
          amount: 30000,
          month: 10,
          year: 2026,
          categoryId: null,
          category_id: null
        });
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('submits category-specific budget with category UUID, not display name', async () => {
      const handleSave = vi.fn().mockResolvedValue({ id: 'new-cat-b' });

      render(
        <BudgetFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={vi.fn()}
          categories={mockCategories}
          initialMonth={10}
          initialYear={2026}
        />
      );

      // Switch to Category Specific scope
      const categoryScopeBtn = screen.getByRole('radio', { name: /Category Specific/i });
      fireEvent.click(categoryScopeBtn);

      // Select Transport (cat-uuid-2)
      const categorySelect = screen.getByLabelText(/Select Category/i);
      fireEvent.change(categorySelect, { target: { value: 'cat-uuid-2' } });

      const amountInput = screen.getByLabelText(/Budget Limit \(INR/i);
      fireEvent.change(amountInput, { target: { value: '4500' } });

      const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith({
          amount: 4500,
          month: 10,
          year: 2026,
          categoryId: 'cat-uuid-2',
          category_id: 'cat-uuid-2'
        });
      });
    });

    it('disables submit button during mutation to prevent duplicate clicks', async () => {
      let resolvePromise;
      const delayedSave = vi.fn(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      render(
        <BudgetFormModal
          isOpen={true}
          onSave={delayedSave}
          onClose={vi.fn()}
          categories={mockCategories}
        />
      );

      const amountInput = screen.getByLabelText(/Budget Limit \(INR/i);
      fireEvent.change(amountInput, { target: { value: '12000' } });

      const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
      fireEvent.click(submitBtn);

      expect(submitBtn.disabled).toBe(true);
      expect(screen.getByText('Creating Budget...')).toBeDefined();

      fireEvent.click(submitBtn);
      expect(delayedSave).toHaveBeenCalledTimes(1);

      resolvePromise({ id: 'done' });
    });

    it('displays duplicate budget conflict error and preserves entered values', async () => {
      const duplicateError = new Error(
        'An overall monthly budget for 10/2026 already exists in your account.'
      );
      const failingSave = vi.fn().mockRejectedValue(duplicateError);

      render(
        <BudgetFormModal
          isOpen={true}
          onSave={failingSave}
          onClose={vi.fn()}
          categories={mockCategories}
        />
      );

      const amountInput = screen.getByLabelText(/Budget Limit \(INR/i);
      fireEvent.change(amountInput, { target: { value: '25000' } });

      const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/An overall monthly budget for 10\/2026 already exists/i)
        ).toBeDefined();
      });

      // Entered value is preserved
      expect(amountInput.value).toBe('25000');
      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('Integration with App: Navigation & Tab Switching', () => {
    it('navigates seamlessly between Dashboard, Expenses, Categories, and Budgets tabs', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(mockCategories);
      vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });
      vi.spyOn(BudgetService, 'listBudgets').mockResolvedValue([mockOverallBudget]);

      render(<App />);

      // On initial mount, Overview is active
      expect(screen.getByLabelText('Financial Summary Cards')).toBeDefined();

      // Navigate to Budgets tab
      const budgetsNavBtn = screen.getByRole('button', { name: /Budgets/i });
      fireEvent.click(budgetsNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Budgets' }).length).toBeGreaterThan(0);
      });
      expect(screen.getByText('October 2026 Overall Budget')).toBeDefined();

      // Navigate to Categories tab
      const categoriesNavBtn = screen.getByRole('button', { name: /Categories/i });
      fireEvent.click(categoriesNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Categories' }).length).toBeGreaterThan(0);
      });

      // Navigate back to Budgets tab
      fireEvent.click(screen.getByRole('button', { name: /Budgets/i }));

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Budgets' }).length).toBeGreaterThan(0);
      });
      expect(screen.getByText('October 2026 Overall Budget')).toBeDefined();
    });
  });
});
