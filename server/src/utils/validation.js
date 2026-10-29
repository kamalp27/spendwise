import { AppError } from './app-error.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ALLOWED_PAYMENT_METHODS = [
  'Cash',
  'Debit Card',
  'Credit Card',
  'UPI',
  'Net Banking',
  'Other'
];

export const ALLOWED_EXPENSE_SORT_FIELDS = ['date', 'amount', 'title', 'created_at'];
export const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

/**
 * Validates a string as a valid UUID v4.
 */
export function validateUUID(value, fieldName = 'id') {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw AppError.badRequest(`Invalid ${fieldName}: must be a valid UUID.`, 'INVALID_UUID');
  }
  return value;
}

/**
 * Validates a string as a calendar date in YYYY-MM-DD format.
 */
export function validateDate(value, fieldName = 'date') {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: must be in YYYY-MM-DD format.`,
      'INVALID_DATE_FORMAT'
    );
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: date does not exist on calendar.`,
      'INVALID_CALENDAR_DATE'
    );
  }

  return value;
}

/**
 * Validates a monetary amount for PostgreSQL NUMERIC(12, 2).
 * Must be > 0 and <= 999999999.99, with at most 2 decimal digits.
 */
export function validateAmount(value, fieldName = 'amount') {
  if (value === undefined || value === null) {
    throw AppError.badRequest(`${fieldName} is required.`, 'MISSING_AMOUNT');
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num) || typeof num !== 'number') {
    throw AppError.badRequest(`${fieldName} must be a valid number.`, 'INVALID_AMOUNT');
  }

  if (num <= 0) {
    throw AppError.badRequest(`${fieldName} must be greater than zero.`, 'AMOUNT_NOT_POSITIVE');
  }

  if (num > 999999999.99) {
    throw AppError.badRequest(
      `${fieldName} exceeds maximum allowable value (999,999,999.99).`,
      'AMOUNT_OUT_OF_BOUNDS'
    );
  }

  // Check scale: at most 2 decimal places
  const strVal = String(value);
  if (strVal.includes('.')) {
    const decimals = strVal.split('.')[1];
    if (decimals && decimals.length > 2) {
      throw AppError.badRequest(
        `${fieldName} cannot have more than 2 decimal places.`,
        'INVALID_DECIMAL_PRECISION'
      );
    }
  }

  return Number(num.toFixed(2));
}

/**
 * Validates payment method against database enum constraint.
 */
export function validatePaymentMethod(value, fieldName = 'payment_method') {
  if (!value) {
    return 'UPI'; // Default if omitted
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(value)) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`,
      'INVALID_PAYMENT_METHOD'
    );
  }

  return value;
}

/**
 * Validates string length and content.
 */
export function validateString(value, { min = 1, max = 255, required = true, fieldName = 'field' } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw AppError.badRequest(`${fieldName} is required.`, `MISSING_${fieldName.toUpperCase()}`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a text string.`, `INVALID_${fieldName.toUpperCase()}`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length < min) {
    throw AppError.badRequest(
      `${fieldName} must be at least ${min} character(s) long.`,
      `${fieldName.toUpperCase()}_TOO_SHORT`
    );
  }

  if (trimmed.length > max) {
    throw AppError.badRequest(
      `${fieldName} cannot exceed ${max} characters.`,
      `${fieldName.toUpperCase()}_TOO_LONG`
    );
  }

  return trimmed;
}

/**
 * Validates hex color code (e.g. #3B82F6).
 */
export function validateHexColor(value, fieldName = 'color') {
  if (!value) {
    return '#3B82F6';
  }

  if (typeof value !== 'string' || !HEX_COLOR_REGEX.test(value)) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: must be a 6-digit hex color (e.g. #3B82F6).`,
      'INVALID_COLOR_FORMAT'
    );
  }

  return value.toUpperCase();
}

/**
 * Validates a month as an integer between 1 and 12.
 */
export function validateMonth(value, fieldName = 'month') {
  if (value === undefined || value === null || value === '') {
    throw AppError.badRequest(`${fieldName} is required.`, `MISSING_${fieldName.toUpperCase()}`);
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 12) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: must be an integer between 1 and 12.`,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }

  return num;
}

/**
 * Validates a year as an integer between 2024 and 2100 (matching database constraint).
 */
export function validateYear(value, fieldName = 'year') {
  if (value === undefined || value === null || value === '') {
    throw AppError.badRequest(`${fieldName} is required.`, `MISSING_${fieldName.toUpperCase()}`);
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 2024 || num > 2100) {
    throw AppError.badRequest(
      `Invalid ${fieldName}: must be an integer between 2024 and 2100.`,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }

  return num;
}

