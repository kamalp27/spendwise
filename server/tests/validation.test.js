import { describe, it, expect } from 'vitest';
import {
  validateUUID,
  validateDate,
  validateAmount,
  validatePaymentMethod,
  validateString,
  validateHexColor,
  validateMonth,
  validateYear,
  ALLOWED_PAYMENT_METHODS
} from '../src/utils/validation.js';

describe('Validation Utilities', () => {
  describe('UUID Validation', () => {
    it('should accept valid UUID v4', () => {
      const valid = '123e4567-e89b-12d3-a456-426614174000';
      expect(validateUUID(valid)).toBe(valid);
    });

    it('should reject malformed UUIDs', () => {
      expect(() => validateUUID('not-a-uuid')).toThrow(/must be a valid UUID/);
      expect(() => validateUUID('12345')).toThrow(/must be a valid UUID/);
      expect(() => validateUUID('')).toThrow(/must be a valid UUID/);
      expect(() => validateUUID(null)).toThrow(/must be a valid UUID/);
    });
  });

  describe('Date Validation', () => {
    it('should accept valid YYYY-MM-DD calendar dates', () => {
      expect(validateDate('2026-10-28')).toBe('2026-10-28');
      expect(validateDate('2024-02-29')).toBe('2024-02-29'); // Leap year
    });

    it('should reject non-existent calendar dates', () => {
      expect(() => validateDate('2025-02-29')).toThrow(/date does not exist on calendar/);
      expect(() => validateDate('2026-04-31')).toThrow(/date does not exist on calendar/);
    });

    it('should reject invalid date formats', () => {
      expect(() => validateDate('28-10-2026')).toThrow(/must be in YYYY-MM-DD format/);
      expect(() => validateDate('2026/10/28')).toThrow(/must be in YYYY-MM-DD format/);
      expect(() => validateDate('invalid')).toThrow(/must be in YYYY-MM-DD format/);
    });
  });

  describe('Amount Validation', () => {
    it('should accept valid positive numbers and strings with at most 2 decimal places', () => {
      expect(validateAmount(100)).toBe(100);
      expect(validateAmount(49.99)).toBe(49.99);
      expect(validateAmount('1250.50')).toBe(1250.5);
    });

    it('should reject zero or negative amounts', () => {
      expect(() => validateAmount(0)).toThrow(/must be greater than zero/);
      expect(() => validateAmount(-50)).toThrow(/must be greater than zero/);
    });

    it('should reject amounts with more than 2 decimal digits', () => {
      expect(() => validateAmount(10.555)).toThrow(/cannot have more than 2 decimal places/);
    });

    it('should reject non-numeric values', () => {
      expect(() => validateAmount('abc')).toThrow(/must be a valid number/);
      expect(() => validateAmount(null)).toThrow(/is required/);
    });
  });

  describe('Payment Method Validation', () => {
    it('should accept allowed payment methods', () => {
      ALLOWED_PAYMENT_METHODS.forEach((method) => {
        expect(validatePaymentMethod(method)).toBe(method);
      });
    });

    it('should default to UPI if omitted', () => {
      expect(validatePaymentMethod(undefined)).toBe('UPI');
    });

    it('should reject unknown payment methods', () => {
      expect(() => validatePaymentMethod('Cryptocurrency')).toThrow(/must be one of:/);
    });
  });

  describe('String and Hex Color Validation', () => {
    it('should trim and validate string length', () => {
      expect(validateString('  Coffee  ', { min: 1, max: 50, fieldName: 'title' })).toBe('Coffee');
      expect(() => validateString('', { min: 1, max: 50, required: true, fieldName: 'title' })).toThrow(/at least 1/);
      expect(() => validateString('a'.repeat(200), { min: 1, max: 150, fieldName: 'title' })).toThrow(/cannot exceed 150/);
    });

    it('should validate hex color strings', () => {
      expect(validateHexColor('#3b82f6')).toBe('#3B82F6');
      expect(validateHexColor('#FFFFFF')).toBe('#FFFFFF');
      expect(() => validateHexColor('red')).toThrow(/must be a 6-digit hex color/);
      expect(() => validateHexColor('#12345')).toThrow(/must be a 6-digit hex color/);
    });
  });

  describe('Month and Year Validation', () => {
    it('should accept valid integers for month (1-12) and year (2024-2100)', () => {
      expect(validateMonth(1)).toBe(1);
      expect(validateMonth(12)).toBe(12);
      expect(validateMonth('10')).toBe(10);
      expect(validateYear(2026)).toBe(2026);
      expect(validateYear('2024')).toBe(2024);
      expect(validateYear(2100)).toBe(2100);
    });

    it('should reject invalid or out-of-range months', () => {
      expect(() => validateMonth(0)).toThrow(/must be an integer between 1 and 12/);
      expect(() => validateMonth(13)).toThrow(/must be an integer between 1 and 12/);
      expect(() => validateMonth(5.5)).toThrow(/must be an integer between 1 and 12/);
      expect(() => validateMonth('abc')).toThrow(/must be an integer between 1 and 12/);
      expect(() => validateMonth(null)).toThrow(/is required/);
    });

    it('should reject invalid or out-of-range years', () => {
      expect(() => validateYear(2023)).toThrow(/must be an integer between 2024 and 2100/);
      expect(() => validateYear(2101)).toThrow(/must be an integer between 2024 and 2100/);
      expect(() => validateYear(2026.5)).toThrow(/must be an integer between 2024 and 2100/);
      expect(() => validateYear('xyz')).toThrow(/must be an integer between 2024 and 2100/);
      expect(() => validateYear(undefined)).toThrow(/is required/);
    });
  });
});
