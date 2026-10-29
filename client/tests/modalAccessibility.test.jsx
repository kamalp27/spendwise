import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseFormModal from '../src/features/expenses/ExpenseFormModal.jsx';
import DeleteConfirmModal from '../src/features/expenses/DeleteConfirmModal.jsx';

describe('Modal Accessibility and Focus Trapping', () => {
  describe('ExpenseFormModal', () => {
    it('sets initial focus to the title input upon opening', async () => {
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText(/Description \/ Title/i);
      await waitFor(() => {
        expect(document.activeElement).toBe(titleInput);
      });
    });

    it('triggers onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={handleClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('wraps focus from last element to first element on Tab', async () => {
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const closeButton = screen.getByLabelText(/Close dialog/i);
      const submitButton = screen.getByRole('button', { name: /Save Expense Draft/i });

      // Focus the last focusable element in the modal (the submit button)
      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);

      // Simulate Tab key press on last element
      fireEvent.keyDown(submitButton, { key: 'Tab', shiftKey: false });

      // Should wrap forward to the first focusable element (closeButton in header)
      expect(document.activeElement).toBe(closeButton);
    });

    it('wraps focus from first element to last element on Shift+Tab', async () => {
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const closeButton = screen.getByLabelText(/Close dialog/i);
      const submitButton = screen.getByRole('button', { name: /Save Expense Draft/i });

      // Focus the first focusable element in the modal (closeButton in header)
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      // Simulate Shift+Tab key press on first element
      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });

      // Should wrap backward to the last focusable element (submitButton in footer)
      expect(document.activeElement).toBe(submitButton);
    });

    it('restores focus to the trigger button when modal is closed', async () => {
      function TestWrapper() {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <div>
            <button
              id="trigger-btn"
              onClick={() => setIsOpen(true)}
            >
              Add Expense Trigger
            </button>
            <ExpenseFormModal
              isOpen={isOpen}
              expenseToEdit={null}
              onSave={vi.fn()}
              onClose={() => setIsOpen(false)}
            />
          </div>
        );
      }

      render(<TestWrapper />);

      const triggerBtn = screen.getByRole('button', { name: /Add Expense Trigger/i });
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      // Open modal
      fireEvent.click(triggerBtn);

      const titleInput = await screen.findByLabelText(/Description \/ Title/i);
      await waitFor(() => {
        expect(document.activeElement).toBe(titleInput);
      });

      // Close modal with Cancel button
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // Focus should be safely restored to triggerBtn
      await waitFor(() => {
        expect(document.activeElement).toBe(triggerBtn);
      });
    });

    it('focuses the first invalid field upon validation failure', async () => {
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText(/Description \/ Title/i);
      const form = screen.getByRole('dialog').querySelector('form');

      // Submit empty form (title is empty)
      fireEvent.submit(form);

      // First invalid field is titleInput
      expect(document.activeElement).toBe(titleInput);
      expect(screen.getByText('Title is required.')).toBeDefined();
    });

    it('focuses the date input if date is invalid on submit', async () => {
      render(
        <ExpenseFormModal
          isOpen={true}
          expenseToEdit={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText(/Description \/ Title/i);
      const amountInput = screen.getByLabelText(/Amount/i);
      const dateInput = screen.getByLabelText(/Date/i);
      const form = screen.getByRole('dialog').querySelector('form');

      // Fill valid title and amount, but clear date so it fails date validation
      fireEvent.change(titleInput, { target: { value: 'Dinner with team' } });
      fireEvent.change(amountInput, { target: { value: '1450.50' } });
      fireEvent.change(dateInput, { target: { value: '' } });

      fireEvent.submit(form);

      // Focus should land on date input
      expect(document.activeElement).toBe(dateInput);
      expect(screen.getByText('Date is required.')).toBeDefined();
    });
  });

  describe('DeleteConfirmModal', () => {
    const mockExpense = {
      id: 'exp-101',
      title: 'Domain Renewal',
      amount: 1200,
      category: 'Utilities',
      date: '2026-10-25'
    };

    it('sets initial focus to the Cancel button upon opening', async () => {
      render(
        <DeleteConfirmModal
          isOpen={true}
          expense={mockExpense}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await waitFor(() => {
        expect(document.activeElement).toBe(cancelButton);
      });
    });

    it('triggers onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <DeleteConfirmModal
          isOpen={true}
          expense={mockExpense}
          onConfirm={vi.fn()}
          onClose={handleClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('restores focus to trigger button when dismissed', async () => {
      function TestDeleteWrapper() {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <div>
            <button
              id="delete-trigger"
              onClick={() => setIsOpen(true)}
            >
              Open Delete
            </button>
            <DeleteConfirmModal
              isOpen={isOpen}
              expense={mockExpense}
              onConfirm={vi.fn()}
              onClose={() => setIsOpen(false)}
            />
          </div>
        );
      }

      render(<TestDeleteWrapper />);
      const trigger = screen.getByRole('button', { name: /Open Delete/i });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);

      const cancelButton = await screen.findByRole('button', { name: /Cancel/i });
      await waitFor(() => {
        expect(document.activeElement).toBe(cancelButton);
      });

      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });
  });
});
