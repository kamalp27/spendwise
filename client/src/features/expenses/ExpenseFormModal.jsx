import React, { useState, useEffect, useRef } from 'react';
import { X, IndianRupee, AlertCircle, Info, Loader2 } from 'lucide-react';
import {
  PREDEFINED_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  DEFAULT_PAYMENT_METHOD
} from './constants.js';
import { validateDateString } from '../../utils/dateValidation.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ExpenseFormModal({
  isOpen,
  expenseToEdit,
  categories = PREDEFINED_CATEGORIES,
  onSave,
  onClose
}) {
  const isEditing = Boolean(expenseToEdit);

  // Modal Container & Input Focus Refs
  const modalContainerRef = useRef(null);
  const titleInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const categorySelectRef = useRef(null);
  const paymentMethodSelectRef = useRef(null);
  const notesTextareaRef = useRef(null);

  // Accessible Focus Trap & Escape Key Listener
  useFocusTrap({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    initialFocusRef: titleInputRef
  });

  // Form Fields State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHOD);
  const [notes, setNotes] = useState('');

  // Validation, Submitting & Error State
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset or populate fields when modal opens or expenseToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        setTitle(expenseToEdit.title || '');
        setAmount(expenseToEdit.amount !== undefined ? String(expenseToEdit.amount) : '');
        setDate(expenseToEdit.date || getTodayString());

        // Resolve category UUID: check categoryId, category_id, or match by name
        let resolvedCatId = expenseToEdit.categoryId || expenseToEdit.category_id || '';
        if (!resolvedCatId && expenseToEdit.category && categories.length > 0) {
          const match = categories.find((c) => c.name === expenseToEdit.category);
          if (match) resolvedCatId = match.id;
        }
        if (!resolvedCatId && categories.length > 0) {
          resolvedCatId = categories[0].id;
        }
        setCategoryId(resolvedCatId);

        setPaymentMethod(
          expenseToEdit.paymentMethod || expenseToEdit.payment_method || DEFAULT_PAYMENT_METHOD
        );
        setNotes(expenseToEdit.notes || '');
      } else {
        setTitle('');
        setAmount('');
        setDate(getTodayString());
        setCategoryId(categories.length > 0 ? categories[0].id : '');
        setPaymentMethod(DEFAULT_PAYMENT_METHOD);
        setNotes('');
      }
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen, expenseToEdit, categories]);

  // Validation function
  function validateField(fieldName, value) {
    switch (fieldName) {
      case 'title': {
        const trimmed = (value || '').trim();
        if (!trimmed) return 'Title is required.';
        if (trimmed.length > 100) return 'Title cannot exceed 100 characters.';
        return null;
      }
      case 'amount': {
        if (value === '' || value === null || value === undefined) {
          return 'Amount is required.';
        }
        const num = Number(value);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
          return 'Amount must be a valid number.';
        }
        if (num <= 0) {
          return 'Amount must be greater than zero.';
        }
        if (num > 10000000) {
          return 'Amount cannot exceed ₹10,000,000.';
        }
        return null;
      }
      case 'date': {
        return validateDateString(value, true);
      }
      case 'categoryId': {
        if (!value) return 'Category is required.';
        if (categories && categories.length > 0) {
          const isValid = categories.some((c) => c.id === value || c.name === value);
          if (!isValid) return 'Please select a valid category.';
        }
        return null;
      }
      case 'paymentMethod': {
        if (!value) return 'Payment method is required.';
        if (!ALLOWED_PAYMENT_METHODS.includes(value)) {
          return 'Please select a valid payment method.';
        }
        return null;
      }
      case 'notes': {
        if (value && value.length > 500) {
          return 'Notes cannot exceed 500 characters.';
        }
        return null;
      }
      default:
        return null;
    }
  }

  function handleBlur(fieldName, value) {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const errorMsg = validateField(fieldName, value);
    setErrors((prev) => ({ ...prev, [fieldName]: errorMsg }));
  }

  function handleChange(fieldName, value, setter) {
    setter(value);
    if (touched[fieldName]) {
      const errorMsg = validateField(fieldName, value);
      setErrors((prev) => ({ ...prev, [fieldName]: errorMsg }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate all fields
    const newErrors = {
      title: validateField('title', title),
      amount: validateField('amount', amount),
      date: validateField('date', date),
      categoryId: validateField('categoryId', categoryId),
      paymentMethod: validateField('paymentMethod', paymentMethod),
      notes: validateField('notes', notes)
    };

    // Filter out nulls
    const activeErrors = {};
    let hasError = false;
    for (const [key, val] of Object.entries(newErrors)) {
      if (val) {
        activeErrors[key] = val;
        hasError = true;
      }
    }

    setTouched({
      title: true,
      amount: true,
      date: true,
      categoryId: true,
      paymentMethod: true,
      notes: true
    });
    setErrors(activeErrors);

    if (hasError) {
      // Accessibility: Focus the first invalid field
      if (activeErrors.title) {
        titleInputRef.current?.focus();
      } else if (activeErrors.amount) {
        amountInputRef.current?.focus();
      } else if (activeErrors.date) {
        dateInputRef.current?.focus();
      } else if (activeErrors.categoryId) {
        categorySelectRef.current?.focus();
      } else if (activeErrors.paymentMethod) {
        paymentMethodSelectRef.current?.focus();
      } else if (activeErrors.notes) {
        notesTextareaRef.current?.focus();
      }
      return;
    }

    // Prepare submitted expense record
    const selectedCategory = categories.find((c) => c.id === categoryId || c.name === categoryId);
    const resolvedCatId = selectedCategory?.id || categoryId;

    const expenseData = {
      ...(isEditing && expenseToEdit?.id ? { id: expenseToEdit.id } : {}),
      title: title.trim(),
      amount: Number(parseFloat(amount).toFixed(2)),
      date,
      categoryId: resolvedCatId,
      category_id: resolvedCatId,
      category: selectedCategory?.name || 'Other',
      categoryName: selectedCategory?.name || 'Other',
      categoryIcon: selectedCategory?.icon || 'tag',
      categoryColor: selectedCategory?.color || '#3B82F6',
      paymentMethod,
      payment_method: paymentMethod,
      notes: notes.trim()
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onSave) {
        await onSave(expenseData);
      }
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to save expense. Please verify your inputs and try again.');
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
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
        className="relative w-full max-w-lg rounded-xl bg-[#0F172A] border border-[#1E293B] shadow-2xl z-10 flex flex-col my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <IndianRupee className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="expense-modal-title" className="text-base font-semibold text-white">
                {isEditing ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {isEditing
                  ? 'Update transaction details'
                  : 'Record a new spending transaction in INR (₹)'}
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

        {/* Server Error Alert Banner */}
        {submitError && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-red-600/10 border border-red-500/20 flex items-start space-x-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" aria-hidden="true" />
            <div className="flex-1">
              <strong className="font-semibold">Unable to save expense:</strong>
              <p className="mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* Context Banner */}
        <div className="mx-5 mt-4 p-3 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-start space-x-2 text-xs text-blue-300">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" aria-hidden="true" />
          <span>
            <strong>Connected Mode:</strong> Expense records are validated and synchronized with the SpendWise backend service.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
          {/* Title / Description */}
          <div>
            <label
              htmlFor="expense-title"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Description / Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="expense-title"
              type="text"
              value={title}
              maxLength={100}
              placeholder="e.g. Grocery items, Lunch with team, Fuel"
              onChange={(e) => handleChange('title', e.target.value, setTitle)}
              onBlur={(e) => handleBlur('title', e.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'expense-title-error' : undefined}
              className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-slate-500 transition-colors focus-visible:outline focus-visible:outline-2 ${
                errors.title
                  ? 'border-red-500 focus-visible:outline-red-500'
                  : 'border-[#1E293B] focus-visible:outline-blue-500'
              }`}
            />
            {errors.title && (
              <p id="expense-title-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errors.title}</span>
              </p>
            )}
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Amount (INR ₹) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <IndianRupee className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  ref={amountInputRef}
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  placeholder="0.00"
                  onChange={(e) => handleChange('amount', e.target.value, setAmount)}
                  onBlur={(e) => handleBlur('amount', e.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-slate-500 transition-colors focus-visible:outline focus-visible:outline-2 ${
                    errors.amount
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
              </div>
              {errors.amount && (
                <p id="expense-amount-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errors.amount}</span>
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="expense-date"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Expense Date <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  ref={dateInputRef}
                  id="expense-date"
                  type="date"
                  value={date}
                  onChange={(e) => handleChange('date', e.target.value, setDate)}
                  onBlur={(e) => handleBlur('date', e.target.value)}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={errors.date ? 'expense-date-error' : undefined}
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white transition-colors focus-visible:outline focus-visible:outline-2 ${
                    errors.date
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
              </div>
              {errors.date && (
                <p id="expense-date-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errors.date}</span>
                </p>
              )}
            </div>
          </div>

          {/* Category & Payment Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Category <span className="text-red-400">*</span>
              </label>
              <select
                ref={categorySelectRef}
                id="expense-category"
                value={categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value, setCategoryId)}
                onBlur={(e) => handleBlur('categoryId', e.target.value)}
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={errors.categoryId ? 'expense-category-error' : undefined}
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
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
              {errors.categoryId && (
                <p id="expense-category-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errors.categoryId}</span>
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label
                htmlFor="expense-payment-method"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Payment Method <span className="text-red-400">*</span>
              </label>
              <select
                ref={paymentMethodSelectRef}
                id="expense-payment-method"
                value={paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value, setPaymentMethod)}
                onBlur={(e) => handleBlur('paymentMethod', e.target.value)}
                aria-invalid={Boolean(errors.paymentMethod)}
                aria-describedby={errors.paymentMethod ? 'expense-payment-method-error' : undefined}
                className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white transition-colors focus-visible:outline focus-visible:outline-2 ${
                  errors.paymentMethod
                    ? 'border-red-500 focus-visible:outline-red-500'
                    : 'border-[#1E293B] focus-visible:outline-blue-500'
                }`}
              >
                {ALLOWED_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method} className="bg-[#0F172A] text-white">
                    {method}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p id="expense-payment-method-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errors.paymentMethod}</span>
                </p>
              )}
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="expense-notes" className="text-xs font-semibold text-slate-200">
                Notes (Optional)
              </label>
              <span className="text-[11px] text-[#94A3B8]">{notes.length}/500</span>
            </div>
            <textarea
              ref={notesTextareaRef}
              id="expense-notes"
              rows="3"
              value={notes}
              maxLength={500}
              placeholder="Store name, invoice reference, or payment remarks..."
              onChange={(e) => handleChange('notes', e.target.value, setNotes)}
              onBlur={(e) => handleBlur('notes', e.target.value)}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? 'expense-notes-error' : undefined}
              className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-slate-500 transition-colors focus-visible:outline focus-visible:outline-2 resize-none ${
                errors.notes
                  ? 'border-red-500 focus-visible:outline-red-500'
                  : 'border-[#1E293B] focus-visible:outline-blue-500'
              }`}
            />
            {errors.notes && (
              <p id="expense-notes-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errors.notes}</span>
              </p>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-[#1E293B] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm shadow-blue-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center space-x-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isEditing
                    ? 'Save Changes'
                    : 'Save Expense Draft'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
