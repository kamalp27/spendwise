import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  AlertCircle,
  Loader2,
  Wallet,
  Tags,
  IndianRupee,
  Calendar
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export default function BudgetFormModal({
  isOpen,
  onSave,
  onClose,
  categories = [],
  initialMonth = 10,
  initialYear = 2026,
  initialType = 'overall'
}) {
  const modalContainerRef = useRef(null);
  const amountInputRef = useRef(null);

  // Accessible Focus Trap & Escape Key Listener
  useFocusTrap({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    initialFocusRef: amountInputRef
  });

  // Form State
  const [budgetType, setBudgetType] = useState(initialType); // 'overall' | 'category'
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // Validation & Submission State
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset or initialize values when modal opens
  useEffect(() => {
    if (isOpen) {
      setBudgetType(initialType);
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setAmount('');
      setMonth(initialMonth);
      setYear(initialYear);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen, initialType, initialMonth, initialYear, categories]);

  function validate(fieldName, value) {
    switch (fieldName) {
      case 'amount': {
        if (value === undefined || value === null || String(value).trim() === '') {
          return 'Budget amount is required.';
        }
        const num = Number(value);
        if (Number.isNaN(num) || num <= 0) {
          return 'Amount must be greater than zero.';
        }
        if (num > 999999999.99) {
          return 'Amount cannot exceed ₹999,999,999.99.';
        }
        const str = String(value);
        if (str.includes('.') && str.split('.')[1].length > 2) {
          return 'Amount cannot have more than 2 decimal places.';
        }
        return null;
      }
      case 'categoryId': {
        if (budgetType === 'category' && (!value || String(value).trim() === '')) {
          return 'Please select a category for this budget.';
        }
        return null;
      }
      case 'month': {
        const m = Number(value);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          return 'Month must be between 1 and 12.';
        }
        return null;
      }
      case 'year': {
        const y = Number(value);
        if (!Number.isInteger(y) || y < 2024 || y > 2100) {
          return 'Year must be between 2024 and 2100.';
        }
        return null;
      }
      default:
        return null;
    }
  }

  function handleAmountChange(e) {
    const val = e.target.value;
    setAmount(val);
    if (submitError) setSubmitError(null);
    if (touched.amount) {
      const err = validate('amount', val);
      setErrors((prev) => ({ ...prev, amount: err }));
    }
  }

  function handleAmountBlur() {
    setTouched((prev) => ({ ...prev, amount: true }));
    const err = validate('amount', amount);
    setErrors((prev) => ({ ...prev, amount: err }));
  }

  function handleCategoryChange(e) {
    const val = e.target.value;
    setCategoryId(val);
    if (submitError) setSubmitError(null);
    if (touched.categoryId) {
      const err = validate('categoryId', val);
      setErrors((prev) => ({ ...prev, categoryId: err }));
    }
  }

  function handleTypeChange(type) {
    setBudgetType(type);
    if (submitError) setSubmitError(null);
    setErrors((prev) => ({ ...prev, categoryId: null }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setTouched({ amount: true, categoryId: true, month: true, year: true });

    const amountErr = validate('amount', amount);
    const categoryErr = validate('categoryId', categoryId);
    const monthErr = validate('month', month);
    const yearErr = validate('year', year);

    if (amountErr || categoryErr || monthErr || yearErr) {
      setErrors({
        amount: amountErr,
        categoryId: categoryErr,
        month: monthErr,
        year: yearErr
      });
      if (amountErr && amountInputRef.current) {
        amountInputRef.current.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      amount: parseFloat(amount),
      month: Number(month),
      year: Number(year),
      categoryId: budgetType === 'category' ? categoryId : null,
      category_id: budgetType === 'category' ? categoryId : null
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      // Preserve form values and show API conflict/error message
      const msg = err.message || 'Failed to create budget. Please try again.';
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-lg rounded-xl bg-[#0F172A] border border-[#1E293B] shadow-2xl z-10 flex flex-col my-8 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <IndianRupee className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="budget-modal-title" className="text-base font-semibold text-white">
                Create Budget Limit
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Set a monthly spending limit for overall or category tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          {/* Server Error Alert Banner */}
          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <span className="font-semibold">Unable to create budget:</span> {submitError}
              </div>
            </div>
          )}

          {/* Budget Scope Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-2">
              Budget Scope <span className="text-red-400">*</span>
            </label>
            <div
              className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B]"
              role="radiogroup"
              aria-label="Budget scope selection"
            >
              <button
                type="button"
                role="radio"
                aria-checked={budgetType === 'overall'}
                onClick={() => handleTypeChange('overall')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  budgetType === 'overall'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Overall Monthly</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={budgetType === 'category'}
                onClick={() => handleTypeChange('category')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  budgetType === 'category'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
                }`}
              >
                <Tags className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Category Specific</span>
              </button>
            </div>
          </div>

          {/* Category Dropdown (when Category scope selected) */}
          {budgetType === 'category' && (
            <div>
              <label
                htmlFor="budget-category-select"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Select Category <span className="text-red-400">*</span>
              </label>
              <select
                id="budget-category-select"
                value={categoryId}
                onChange={handleCategoryChange}
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={errors.categoryId ? 'budget-category-error' : undefined}
                className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white transition-colors focus-visible:outline focus-visible:outline-2 ${
                  errors.categoryId
                    ? 'border-red-500 focus-visible:outline-red-500'
                    : 'border-[#1E293B] focus-visible:outline-blue-500'
                }`}
              >
                {categories.length === 0 ? (
                  <option value="" disabled>
                    No categories available
                  </option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-[#0F172A] text-white">
                      {cat.name} {cat.isPredefined ? '(Default)' : '(Custom)'}
                    </option>
                  ))
                )}
              </select>
              {errors.categoryId && (
                <p id="budget-category-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errors.categoryId}</span>
                </p>
              )}
            </div>
          )}

          {/* Month & Year Selection Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="budget-month-select"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Month <span className="text-red-400">*</span>
              </label>
              <select
                id="budget-month-select"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1} className="bg-[#0F172A] text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="budget-year-select"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Year <span className="text-red-400">*</span>
              </label>
              <select
                id="budget-year-select"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-[#0F172A] text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="budget-amount-input"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Budget Limit (INR ₹) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                <IndianRupee className="w-4 h-4" aria-hidden="true" />
              </div>
              <input
                ref={amountInputRef}
                id="budget-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 10000"
                value={amount}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'budget-amount-error' : undefined}
                className={`w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-slate-500 transition-colors focus-visible:outline focus-visible:outline-2 ${
                  errors.amount
                    ? 'border-red-500 focus-visible:outline-red-500'
                    : 'border-[#1E293B] focus-visible:outline-blue-500'
                }`}
              />
            </div>
            {errors.amount && (
              <p id="budget-amount-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errors.amount}</span>
              </p>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Creating Budget...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Create Budget</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
