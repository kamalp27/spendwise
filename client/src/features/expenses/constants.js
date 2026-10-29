/**
 * Standard backend-aligned category and payment method definitions for SpendWise.
 * Mirrors server/src/utils/validation.js and server/src/db/seed.js.
 */

export const PREDEFINED_CATEGORIES = [
  { id: 'cat-1', name: 'Food & Dining', color: '#EF4444', icon: 'utensils' },
  { id: 'cat-2', name: 'Transport', color: '#F97316', icon: 'car' },
  { id: 'cat-3', name: 'Shopping', color: '#F59E0B', icon: 'shopping-bag' },
  { id: 'cat-4', name: 'Bills & Utilities', color: '#10B981', icon: 'receipt' },
  { id: 'cat-5', name: 'Health & Medical', color: '#06B6D4', icon: 'heart-pulse' },
  { id: 'cat-6', name: 'Education', color: '#3B82F6', icon: 'graduation-cap' },
  { id: 'cat-7', name: 'Entertainment', color: '#8B5CF6', icon: 'film' },
  { id: 'cat-8', name: 'Other', color: '#6B7280', icon: 'tag' }
];

export const ALLOWED_PAYMENT_METHODS = [
  'UPI',
  'Debit Card',
  'Credit Card',
  'Cash',
  'Net Banking',
  'Other'
];

export const DEFAULT_PAYMENT_METHOD = 'UPI';

export const SORT_OPTIONS = [
  { id: 'date-desc', label: 'Date (Newest First)' },
  { id: 'date-asc', label: 'Date (Oldest First)' },
  { id: 'amount-desc', label: 'Amount (High to Low)' },
  { id: 'amount-asc', label: 'Amount (Low to High)' }
];
