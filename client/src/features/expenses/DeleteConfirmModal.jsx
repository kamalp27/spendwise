import React, { useRef, useState } from 'react';
import { AlertTriangle, X, IndianRupee, AlertCircle, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export default function DeleteConfirmModal({
  isOpen,
  expense,
  onConfirm,
  onClose
}) {
  const modalContainerRef = useRef(null);
  const cancelButtonRef = useRef(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Accessible Focus Trap & Escape Key Listener
  useFocusTrap({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    initialFocusRef: cancelButtonRef
  });

  if (!isOpen || !expense) return null;

  async function handleConfirmClick() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (onConfirm) {
        await onConfirm(expense.id);
      }
      setIsDeleting(false);
      onClose();
    } catch (err) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Failed to delete expense. Please try again.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => !isDeleting && onClose()}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-md rounded-xl bg-[#0F172A] border border-[#1E293B] p-6 shadow-2xl z-10"
      >
        <div className="flex items-start justify-between pb-4 border-b border-[#1E293B]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="delete-modal-title" className="text-base font-semibold text-white">
                Delete Expense
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Confirm removal of this transaction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Error Alert if Deletion Fails */}
        {deleteError && (
          <div className="mt-4 p-3 rounded-lg bg-red-600/10 border border-red-500/20 flex items-start space-x-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" aria-hidden="true" />
            <div className="flex-1">
              <strong className="font-semibold">Unable to delete expense:</strong>
              <p className="mt-0.5">{deleteError}</p>
            </div>
          </div>
        )}

        {/* Expense Summary Box */}
        <div className="my-5 p-4 rounded-lg bg-[#0B0F19] border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white truncate max-w-[240px]">
              {expense.title}
            </span>
            <span className="font-bold text-red-400 flex items-center">
              <IndianRupee className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{Number(expense.amount).toFixed(2)}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Category: <strong className="text-slate-300">{expense.categoryName || expense.category}</strong></span>
            <span>Date: <strong className="text-slate-300">{expense.date}</strong></span>
          </div>
        </div>

        <p className="text-xs text-[#94A3B8] leading-relaxed">
          Are you sure you want to delete this expense? This action will permanently remove the record from your account.
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center space-x-1.5"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>{isDeleting ? 'Deleting...' : 'Delete Expense'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
