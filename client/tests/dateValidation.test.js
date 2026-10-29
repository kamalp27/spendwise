import { describe, it, expect } from 'vitest';
import { validateDateString } from '../src/utils/dateValidation.js';

describe('validateDateString', () => {
  describe('Valid calendar dates', () => {
    it('accepts valid ordinary calendar dates', () => {
      expect(validateDateString('2026-10-28')).toBeNull();
      expect(validateDateString('2023-01-15')).toBeNull();
      expect(validateDateString('2025-12-31')).toBeNull();
    });

    it('accepts valid leap year dates on leap years', () => {
      expect(validateDateString('2024-02-29')).toBeNull();
      expect(validateDateString('2000-02-29')).toBeNull();
    });

    it('accepts valid 30-day and 31-day month boundaries', () => {
      expect(validateDateString('2026-01-31')).toBeNull();
      expect(validateDateString('2026-03-31')).toBeNull();
      expect(validateDateString('2026-04-30')).toBeNull();
      expect(validateDateString('2026-05-31')).toBeNull();
      expect(validateDateString('2026-06-30')).toBeNull();
      expect(validateDateString('2026-07-31')).toBeNull();
      expect(validateDateString('2026-08-31')).toBeNull();
      expect(validateDateString('2026-09-30')).toBeNull();
      expect(validateDateString('2026-10-31')).toBeNull();
      expect(validateDateString('2026-11-30')).toBeNull();
      expect(validateDateString('2026-12-31')).toBeNull();
      expect(validateDateString('2026-02-28')).toBeNull();
    });
  });

  describe('Impossible calendar dates', () => {
    it('rejects February 31', () => {
      expect(validateDateString('2026-02-31')).toBe('Date does not exist on calendar.');
    });

    it('rejects February 30', () => {
      expect(validateDateString('2026-02-30')).toBe('Date does not exist on calendar.');
    });

    it('rejects February 29 on non-leap years', () => {
      expect(validateDateString('2025-02-29')).toBe('Date does not exist on calendar.');
      expect(validateDateString('2026-02-29')).toBe('Date does not exist on calendar.');
      expect(validateDateString('2100-02-29')).toBe('Date does not exist on calendar.');
    });

    it('rejects 31st on 30-day months', () => {
      expect(validateDateString('2026-04-31')).toBe('Date does not exist on calendar.');
      expect(validateDateString('2026-06-31')).toBe('Date does not exist on calendar.');
      expect(validateDateString('2026-09-31')).toBe('Date does not exist on calendar.');
      expect(validateDateString('2026-11-31')).toBe('Date does not exist on calendar.');
    });
  });

  describe('Invalid month and day bounds', () => {
    it('rejects months outside 01-12', () => {
      expect(validateDateString('2026-00-15')).toBe('Month must be between 01 and 12.');
      expect(validateDateString('2026-13-01')).toBe('Month must be between 01 and 12.');
    });

    it('rejects days outside 01-31', () => {
      expect(validateDateString('2026-05-00')).toBe('Day must be between 01 and 31.');
      expect(validateDateString('2026-05-32')).toBe('Day must be between 01 and 31.');
    });
  });

  describe('Malformed date strings', () => {
    it('rejects non-padded single digit month or day', () => {
      expect(validateDateString('2026-2-5')).toBe('Date must follow YYYY-MM-DD format.');
      expect(validateDateString('2026-02-5')).toBe('Date must follow YYYY-MM-DD format.');
    });

    it('rejects slash delimiters and non-date text', () => {
      expect(validateDateString('2026/02/20')).toBe('Date must follow YYYY-MM-DD format.');
      expect(validateDateString('not-a-date')).toBe('Date must follow YYYY-MM-DD format.');
      expect(validateDateString('2026-MM-DD')).toBe('Date must follow YYYY-MM-DD format.');
    });

    it('rejects non-string values', () => {
      expect(validateDateString(12345)).toBe('Date must be a text string in YYYY-MM-DD format.');
      expect(validateDateString({})).toBe('Date must be a text string in YYYY-MM-DD format.');
    });
  });

  describe('Required vs Optional handling', () => {
    it('rejects missing or empty strings when required', () => {
      expect(validateDateString('', true)).toBe('Date is required.');
      expect(validateDateString('   ', true)).toBe('Date is required.');
      expect(validateDateString(null, true)).toBe('Date is required.');
      expect(validateDateString(undefined, true)).toBe('Date is required.');
    });

    it('allows missing or empty strings when optional', () => {
      expect(validateDateString('', false)).toBeNull();
      expect(validateDateString('   ', false)).toBeNull();
      expect(validateDateString(null, false)).toBeNull();
      expect(validateDateString(undefined, false)).toBeNull();
    });
  });
});
