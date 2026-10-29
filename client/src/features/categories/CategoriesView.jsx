import React, { useState, useMemo } from 'react';
import {
  Plus,
  Tags,
  Shield,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  X
} from 'lucide-react';
import CategoryCard from './CategoryCard.jsx';
import CategoryFormModal from './CategoryFormModal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

export default function CategoriesView({
  categories = [],
  isLoading = false,
  error = null,
  onRetry = null,
  onSaveCategory = null
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Partition categories into Predefined and Custom sets
  const { predefinedCategories, customCategories } = useMemo(() => {
    const predefined = [];
    const custom = [];

    for (const cat of categories) {
      if (cat.isPredefined || cat.is_predefined) {
        predefined.push(cat);
      } else {
        custom.push(cat);
      }
    }

    return { predefinedCategories: predefined, customCategories: custom };
  }, [categories]);

  async function handleSaveCategory(categoryData) {
    if (onSaveCategory) {
      const created = await onSaveCategory(categoryData);
      const categoryName = created?.name || categoryData.name;
      setSuccessMessage(`Custom category "${categoryName}" was successfully created.`);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Categories
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
            Manage system default and custom expense categories for accurate categorization and tracking.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Category</span>
          </button>
        </div>
      </section>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs text-emerald-400"
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Success:</strong> {successMessage}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded text-emerald-400 hover:text-white hover:bg-emerald-600/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-400"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Failed to load categories:</strong> {error}
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

      {/* Metric Breakdown Cards */}
      <section
        aria-label="Category Overview Metrics"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#94A3B8]">Total Categories</span>
            <span className="text-xl font-bold text-white mt-0.5">
              {isLoading && categories.length === 0 ? '—' : categories.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Tags className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#94A3B8]">System Predefined</span>
            <span className="text-xl font-bold text-white mt-0.5">
              {isLoading && categories.length === 0 ? '—' : predefinedCategories.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#1E293B] text-[#94A3B8] border border-[#334155]/40 flex items-center justify-center">
            <Shield className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#94A3B8]">Custom Categories</span>
            <span className="text-xl font-bold text-blue-400 mt-0.5">
              {isLoading && categories.length === 0 ? '—' : customCategories.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Custom Categories Section */}
      <section aria-labelledby="custom-categories-heading" className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center space-x-2">
            <h2 id="custom-categories-heading" className="text-base font-bold text-white tracking-tight">
              Custom Categories
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30">
              {customCategories.length}
            </span>
          </div>
          {customCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded px-1"
            >
              + Create Another
            </button>
          )}
        </div>

        {customCategories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No custom categories yet"
            description="Create custom categories to organize personal expenses tailored to your unique financial habits."
            actionLabel="Add Custom Category"
            onAction={() => setIsModalOpen(true)}
            className="my-2"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {customCategories.map((cat) => (
              <CategoryCard key={cat.id || cat.name} category={cat} />
            ))}
          </div>
        )}
      </section>

      {/* System Predefined Categories Section */}
      <section aria-labelledby="predefined-categories-heading" className="space-y-3 pt-2">
        <div className="flex items-center space-x-2 pb-1">
          <h2 id="predefined-categories-heading" className="text-base font-bold text-white tracking-tight">
            System Predefined Categories
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] font-semibold border border-[#334155]/40">
            {predefinedCategories.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {predefinedCategories.map((cat) => (
            <CategoryCard key={cat.id || cat.name} category={cat} />
          ))}
        </div>
      </section>

      {/* Modal Dialog for Category Creation */}
      <CategoryFormModal
        isOpen={isModalOpen}
        onSave={handleSaveCategory}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
