/**
 * Strict calendar date validation utility for SpendWise.
 * Mirrors the backend calendar validation algorithm in server/src/utils/validation.js.
 */

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a date string in YYYY-MM-DD format.
 * Strictly verifies calendar existence (rejects Feb 31, Apr 31, non-leap Feb 29, invalid months/days).
 *
 * @param {string} value - Date string to validate.
 * @param {boolean} [required=true] - Whether an empty or missing value is considered an error.
 * @returns {string | null} Returns an error message if invalid, or null if valid.
 */
export function validateDateString(value, required = true) {
  if (value === undefined || value === null || value === '') {
    return required ? 'Date is required.' : null;
  }

  if (typeof value !== 'string') {
    return 'Date must be a text string in YYYY-MM-DD format.';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return required ? 'Date is required.' : null;
  }

  // 1. Strict Format Check: YYYY-MM-DD
  if (!DATE_FORMAT_REGEX.test(trimmed)) {
    return 'Date must follow YYYY-MM-DD format.';
  }

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // 2. Month boundaries (01 - 12)
  if (month < 1 || month > 12) {
    return 'Month must be between 01 and 12.';
  }

  // 3. Day boundaries (01 - 31)
  if (day < 1 || day > 31) {
    return 'Day must be between 01 and 31.';
  }

  // 4. Strict Calendar Existence Verification
  // Construct UTC date to avoid timezone offset discrepancies
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    return 'Date does not exist on calendar.';
  }

  return null;
}
