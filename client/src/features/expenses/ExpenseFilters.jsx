import React from 'react';
import { Search, Filter, X, ArrowUpDown } from 'lucide-react';
import {
  PREDEFINED_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  SORT_OPTIONS
} from './constants.js';

export default function ExpenseFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPaymentMethod,
  onPaymentMethodChange,
  selectedSort,
  onSortChange,
  onResetFilters,
  hasActiveFilters,
  categories = PREDEFINED_CATEGORIES
}) {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
      {/* Search Input Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Text Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
            <Search className="w-4 h-4" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchQuery}
            placeholder="Search by title, merchant, or notes..."
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search transactions"
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-sm text-white placeholder-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search input"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Reset Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1E293B]/70">
        {/* Category Filter */}
        <div className="flex flex-col space-y-1">
          <label htmlFor="filter-category" className="text-[11px] font-medium text-[#94A3B8]">
            Category
          </label>
          <select
            id="filter-category"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 transition-colors"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-[#0F172A] text-white">
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method Filter */}
        <div className="flex flex-col space-y-1">
          <label htmlFor="filter-method" className="text-[11px] font-medium text-[#94A3B8]">
            Payment Method
          </label>
          <select
            id="filter-method"
            value={selectedPaymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 transition-colors"
          >
            <option value="ALL">All Payment Methods</option>
            {ALLOWED_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method} className="bg-[#0F172A] text-white">
                {method}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Options */}
        <div className="flex flex-col space-y-1">
          <label htmlFor="filter-sort" className="text-[11px] font-medium text-[#94A3B8]">
            Sort By
          </label>
          <select
            id="filter-sort"
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-[#0F172A] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
