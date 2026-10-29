import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';
import CategoriesView from '../src/features/categories/CategoriesView.jsx';
import CategoryFormModal from '../src/features/categories/CategoryFormModal.jsx';
import CategoryCard from '../src/features/categories/CategoryCard.jsx';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';

describe('Category Management Feature (Stage 5.5)', () => {
  const mockPredefinedCategories = [
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

  const mockCustomCategory = {
    id: 'cat-uuid-custom-1',
    name: 'Freelance Design',
    icon: 'laptop',
    color: '#3B82F6',
    isPredefined: false,
    is_predefined: false,
    userId: 'user-uuid-1'
  };

  const allMockCategories = [...mockPredefinedCategories, mockCustomCategory];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CategoriesView Rendering & Partitioning', () => {
    it('renders categories metrics and distinguishes predefined and custom categories', () => {
      render(
        <CategoriesView
          categories={allMockCategories}
          isLoading={false}
          error={null}
        />
      );

      // Verify header and metric overview
      expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeDefined();
      expect(screen.getByText('Total Categories')).toBeDefined();
      expect(screen.getByText('System Predefined')).toBeDefined();
      expect(screen.getAllByText('Custom Categories').length).toBeGreaterThan(0);

      // Verify Predefined Category Card
      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('Transport')).toBeDefined();
      expect(screen.getAllByText('Predefined').length).toBe(2);

      // Verify Custom Category Card
      expect(screen.getByText('Freelance Design')).toBeDefined();
      expect(screen.getByText('Custom')).toBeDefined();
      expect(screen.getByText('#3B82F6')).toBeDefined();
    });

    it('renders empty state when there are no user custom categories', () => {
      render(
        <CategoriesView
          categories={mockPredefinedCategories}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('No custom categories yet')).toBeDefined();
      expect(
        screen.getByText(
          /Create custom categories to organize personal expenses tailored to your unique financial habits/i
        )
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Add Custom Category' })).toBeDefined();
    });

    it('displays error alert and allows retrying when loading fails', () => {
      const handleRetry = vi.fn();
      render(
        <CategoriesView
          categories={[]}
          isLoading={false}
          error="Network connection lost"
          onRetry={handleRetry}
        />
      );

      expect(screen.getByText(/Failed to load categories:/i)).toBeDefined();
      expect(screen.getByText(/Network connection lost/i)).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('shows syncing indicator when loading', () => {
      render(
        <CategoriesView
          categories={allMockCategories}
          isLoading={true}
          error={null}
        />
      );

      expect(screen.getByText('Syncing...')).toBeDefined();
    });
  });

  describe('CategoryFormModal Validation & Creation', () => {
    it('renders modal with initial focus on category name input and handles escape key dismissal', () => {
      const handleClose = vi.fn();
      render(
        <CategoryFormModal
          isOpen={true}
          onSave={vi.fn()}
          onClose={handleClose}
        />
      );

      const modal = screen.getByRole('dialog', { name: /New Custom Category/i });
      expect(modal).toBeDefined();

      const nameInput = screen.getByLabelText(/Category Name/i);
      expect(nameInput).toBeDefined();

      // Escape key closes modal
      fireEvent.keyDown(modal, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('validates required category name and character length limits', async () => {
      const handleSave = vi.fn();
      render(
        <CategoryFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={vi.fn()}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Create Category/i });

      // Submit without name
      fireEvent.click(submitBtn);

      expect(screen.getByText('Category name is required.')).toBeDefined();
      expect(handleSave).not.toHaveBeenCalled();

      // Type valid name
      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Fitness & Gym' } });

      // Submit with valid name
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledTimes(1);
      });
      expect(handleSave).toHaveBeenCalledWith({
        name: 'Fitness & Gym',
        color: '#3B82F6',
        icon: 'tag'
      });
    });

    it('allows selecting color and icon and updates live preview', async () => {
      const handleSave = vi.fn().mockResolvedValue({ id: 'new-id', name: 'Subscriptions' });
      const handleClose = vi.fn();

      render(
        <CategoryFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Subscriptions' } });

      // Select Purple color swatch
      const purpleSwatch = screen.getByLabelText(/Select color Purple/i);
      fireEvent.click(purpleSwatch);

      // Select Entertainment (Film) icon
      const filmIconBtn = screen.getByLabelText(/Select Entertainment icon/i);
      fireEvent.click(filmIconBtn);

      // Verify live preview shows updated color and icon
      const previewText = screen.getByText(/#8B5CF6 • film/i);
      expect(previewText).toBeDefined();

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Create Category/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith({
          name: 'Subscriptions',
          color: '#8B5CF6',
          icon: 'film'
        });
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('validates custom hex color code format', () => {
      const handleSave = vi.fn();
      render(
        <CategoryFormModal
          isOpen={true}
          onSave={handleSave}
          onClose={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Consulting' } });

      const customHexInput = screen.getByLabelText(/Custom hex color code/i);
      fireEvent.change(customHexInput, { target: { value: 'not-a-hex' } });

      const submitBtn = screen.getByRole('button', { name: /Create Category/i });
      fireEvent.click(submitBtn);

      expect(
        screen.getByText(/Color must be a valid 6-digit hex code/i)
      ).toBeDefined();
      expect(handleSave).not.toHaveBeenCalled();
    });

    it('disables submit button during submission to prevent duplicate clicks', async () => {
      let resolvePromise;
      const delayedSave = vi.fn(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      render(
        <CategoryFormModal
          isOpen={true}
          onSave={delayedSave}
          onClose={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Investment Portfolios' } });

      const submitBtn = screen.getByRole('button', { name: /Create Category/i });
      fireEvent.click(submitBtn);

      // Verify button is disabled and shows loading indicator
      expect(submitBtn.disabled).toBe(true);
      expect(screen.getByText('Creating Category...')).toBeDefined();

      // Second click does nothing
      fireEvent.click(submitBtn);
      expect(delayedSave).toHaveBeenCalledTimes(1);

      // Resolve creation
      resolvePromise({ id: 'inv-cat', name: 'Investment Portfolios' });
    });

    it('displays API error and preserves user input when creation fails', async () => {
      const failingSave = vi
        .fn()
        .mockRejectedValue(
          new Error('A category named "Freelance Design" already exists in your account.')
        );

      render(
        <CategoryFormModal
          isOpen={true}
          onSave={failingSave}
          onClose={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Freelance Design' } });

      const submitBtn = screen.getByRole('button', { name: /Create Category/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/A category named "Freelance Design" already exists/i)
        ).toBeDefined();
      });

      // Assert user input is preserved
      expect(nameInput.value).toBe('Freelance Design');
      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('Integration with App: Navigation & Cross-Component Availability', () => {
    it('navigates seamlessly between Dashboard, Expenses, and Categories tabs', async () => {
      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue(allMockCategories);
      vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(<App />);

      // On initial mount, Overview (Dashboard) is active
      expect(screen.getByLabelText('Financial Summary Cards')).toBeDefined();

      // Navigate to Categories tab
      const categoriesNavBtn = screen.getByRole('button', { name: /Categories/i });
      fireEvent.click(categoriesNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Categories' }).length).toBeGreaterThan(0);
      });
      expect(screen.getByText('System Predefined Categories')).toBeDefined();
      expect(screen.getAllByText('Custom Categories').length).toBeGreaterThan(0);

      // Navigate to Transactions tab
      const transactionsNavBtn = screen.getByRole('button', { name: /Transactions/i });
      fireEvent.click(transactionsNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Transactions' }).length).toBeGreaterThan(0);
      });

      // Navigate back to Overview
      const overviewNavBtn = screen.getByRole('button', { name: /Overview/i });
      fireEvent.click(overviewNavBtn);

      await waitFor(() => {
        expect(screen.getByLabelText('Financial Summary Cards')).toBeDefined();
      });
    });

    it('newly created category refreshes category list and appears in expense form and filter', async () => {
      let currentCategories = [...mockPredefinedCategories];

      vi.spyOn(CategoryService, 'getCategories').mockImplementation(async () => currentCategories);
      const createCategorySpy = vi
        .spyOn(CategoryService, 'createCategory')
        .mockImplementation(async ({ name, color, icon }) => {
          const newCategory = {
            id: 'cat-uuid-gym',
            name,
            color,
            icon,
            isPredefined: false,
            is_predefined: false,
            userId: 'user-uuid-1'
          };
          currentCategories = [...currentCategories, newCategory];
          return newCategory;
        });

      vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(<App />);

      // 1. Navigate to Categories tab
      const categoriesNavBtn = screen.getByRole('button', { name: /Categories/i });
      fireEvent.click(categoriesNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Categories' }).length).toBeGreaterThan(0);
      });

      // Initially no custom categories
      expect(screen.getByText('No custom categories yet')).toBeDefined();

      // 2. Click Add Category to open modal
      const addCategoryBtn = screen.getByRole('button', { name: /Add Category/i });
      fireEvent.click(addCategoryBtn);

      const modal = screen.getByRole('dialog', { name: /New Custom Category/i });
      expect(modal).toBeDefined();

      // 3. Fill form and submit
      const nameInput = screen.getByLabelText(/Category Name/i);
      fireEvent.change(nameInput, { target: { value: 'Gym & Fitness' } });

      const submitBtn = screen.getByRole('button', { name: /Create Category/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createCategorySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Gym & Fitness'
          })
        );
      });

      // Assert category appears in Categories view
      await waitFor(() => {
        expect(screen.getByText('Gym & Fitness')).toBeDefined();
      });
      expect(
        screen.getByText(/Custom category "Gym & Fitness" was successfully created/i)
      ).toBeDefined();

      // 4. Switch to Transactions tab
      const transactionsNavBtn = screen.getByRole('button', { name: /Transactions/i });
      fireEvent.click(transactionsNavBtn);

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1, name: 'Transactions' }).length).toBeGreaterThan(0);
      });

      // Verify category filter includes Gym & Fitness option
      const categoryFilter = screen.getByLabelText('Category');
      const filterOptions = Array.from(categoryFilter.querySelectorAll('option')).map(
        (opt) => opt.textContent
      );
      expect(filterOptions).toContain('Gym & Fitness');

      // 5. Open Add Expense Modal
      const addExpenseBtn = screen.getByRole('button', { name: /Add Expense/i });
      fireEvent.click(addExpenseBtn);

      const expenseModal = screen.getByRole('dialog', { name: /Add New Expense/i });
      expect(expenseModal).toBeDefined();

      // Verify expense form Category select includes Gym & Fitness option
      const expenseCategorySelect = screen.getByLabelText(/Category \*/i);
      const expenseOptions = Array.from(expenseCategorySelect.querySelectorAll('option')).map(
        (opt) => opt.textContent
      );
      expect(expenseOptions).toContain('Gym & Fitness');
    });
  });
});
