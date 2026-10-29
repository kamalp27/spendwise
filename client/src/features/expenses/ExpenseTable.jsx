import React from 'react';
import {
  Receipt,
  IndianRupee,
  Pencil,
  Trash2,
  Info
} from 'lucide-react';
import EmptyState from '../../components/common/EmptyState.jsx';
import { PREDEFINED_CATEGORIES } from './constants.js';

function getCategoryColor(catName) {
  const match = PREDEFINED_CATEGORIES.find((c) => c.name === catName);
  return match ? match.color : '#3B82F6';
}

export default function ExpenseTable({
  expenses = [],
  onEditExpense,
  onDeleteExpense,
  hasActiveFilters,
  onResetFilters,
  onAddExpense
}) {
  // Empty State Handling
  if (expenses.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          icon={Receipt}
          title="No matching transactions"
          description="None of your transactions match the active search and filter criteria. Try searching for a different term or clearing your filters."
          actionLabel="Clear Filters"
          onAction={onResetFilters}
          className="my-4"
        />
      );
    }

    return (
      <EmptyState
        icon={Receipt}
        title="No transactions recorded yet"
        description="Your personal expense tracker is ready. You can record daily spending with category, payment method (UPI, Card, Cash, Net Banking), date, and amount in Indian Rupees (₹)."
        actionLabel="Add First Expense"
        onAction={onAddExpense}
        className="my-4"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Session State Banner */}
      <div className="p-3 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-between text-xs text-blue-300">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>Authoritative Records ({expenses.length}):</strong> Synchronized with the SpendWise backend API service.
          </span>
        </div>
        <span className="hidden sm:inline-block font-mono text-[11px] text-blue-400">
          API Synchronized
        </span>
      </div>

      {/* Desktop Table View (visible on md+) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[#1E293B] bg-[#0F172A] shadow-sm">
        <table className="w-full text-left text-sm" aria-label="Transactions table">
          <thead className="bg-[#0B0F19]/60 text-xs font-semibold text-[#94A3B8] border-b border-[#1E293B]">
            <tr>
              <th scope="col" className="py-3 px-4">Date</th>
              <th scope="col" className="py-3 px-4">Description</th>
              <th scope="col" className="py-3 px-4">Category</th>
              <th scope="col" className="py-3 px-4">Payment Method</th>
              <th scope="col" className="py-3 px-4 text-right">Amount</th>
              <th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/60 text-slate-200">
            {expenses.map((expense) => {
              const categoryColor =
                expense.categoryColor ||
                getCategoryColor(expense.categoryName || expense.category);
              const categoryDisplay = expense.categoryName || expense.category || 'Other';

              return (
                <tr
                  key={expense.id}
                  className="hover:bg-[#1E293B]/30 transition-colors group"
                >
                  {/* Date */}
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-[#94A3B8]">
                    {expense.date}
                  </td>

                  {/* Title & Notes */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {expense.title}
                      </span>
                      {expense.notes && (
                        <span className="text-xs text-[#94A3B8] truncate max-w-xs mt-0.5" title={expense.notes}>
                          {expense.notes}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category Pill */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${categoryColor}15`,
                        color: categoryColor,
                        border: `1px solid ${categoryColor}30`
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: categoryColor }}
                        aria-hidden="true"
                      />
                      <span>{categoryDisplay}</span>
                    </span>
                  </td>

                  {/* Payment Method */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1E293B] text-[11px] text-slate-300">
                      {expense.paymentMethod || expense.payment_method}
                    </span>
                  </td>

                  {/* Amount (INR ₹) */}
                  <td className="py-3 px-4 font-bold text-white text-right whitespace-nowrap">
                    <span className="inline-flex items-center space-x-0.5 justify-end">
                      <IndianRupee className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                      <span>{Number(expense.amount).toFixed(2)}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        aria-label={`Edit ${expense.title}`}
                        title="Edit expense"
                        className="p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-[#1E293B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense)}
                        aria-label={`Delete ${expense.title}`}
                        title="Delete expense"
                        className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (visible on mobile < md) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {expenses.map((expense) => {
          const categoryColor =
            expense.categoryColor ||
            getCategoryColor(expense.categoryName || expense.category);
          const categoryDisplay = expense.categoryName || expense.category || 'Other';

          return (
            <div
              key={expense.id}
              className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3"
            >
              {/* Header: Title and Amount */}
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {expense.title}
                  </h4>
                  <span className="text-[11px] font-mono text-[#94A3B8]">
                    {expense.date}
                  </span>
                </div>
                <div className="font-bold text-base text-white flex items-center flex-shrink-0">
                  <IndianRupee className="w-4 h-4 text-blue-400" aria-hidden="true" />
                  <span>{Number(expense.amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Badges: Category & Payment Method */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: `${categoryColor}15`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}30`
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                    aria-hidden="true"
                  />
                  <span>{categoryDisplay}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1E293B] text-[10px] text-slate-300">
                  {expense.paymentMethod || expense.payment_method}
                </span>
              </div>

              {/* Notes if available */}
              {expense.notes && (
                <p className="text-xs text-[#94A3B8] italic">
                  "{expense.notes}"
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#1E293B]/70 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => onEditExpense(expense)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteExpense(expense)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
