import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
} from '../src/utils/password.js';

describe('Password Security Utilities (Argon2id)', () => {
  describe('Password Strength Validation', () => {
    it('should reject missing or empty password', () => {
      expect(() => validatePasswordStrength('')).toThrowError(/Password is required/);
      expect(() => validatePasswordStrength(null)).toThrowError(/Password is required/);
      expect(() => validatePasswordStrength(undefined)).toThrowError(/Password is required/);
    });

    it('should reject passwords shorter than minimum length', () => {
      expect(() => validatePasswordStrength('Ab1!')).toThrowError(
        new RegExp(`at least ${MIN_PASSWORD_LENGTH} characters`)
      );
    });

    it('should reject passwords longer than maximum length', () => {
      const longPassword = 'A1a' + 'x'.repeat(MAX_PASSWORD_LENGTH);
      expect(() => validatePasswordStrength(longPassword)).toThrowError(
        new RegExp(`cannot exceed ${MAX_PASSWORD_LENGTH} characters`)
      );
    });

    it('should reject passwords missing uppercase, lowercase, or digit', () => {
      expect(() => validatePasswordStrength('alllowercase1')).toThrowError(/uppercase letter/);
      expect(() => validatePasswordStrength('ALLUPPERCASE1')).toThrowError(/lowercase letter/);
      expect(() => validatePasswordStrength('NoNumbersHere!')).toThrowError(/number/);
    });

    it('should accept valid complex passwords', () => {
      expect(validatePasswordStrength('ValidP@ssw0rd!')).toBe('ValidP@ssw0rd!');
      expect(validatePasswordStrength('MySecurePass123')).toBe('MySecurePass123');
    });
  });

  describe('Argon2id Hashing & Verification', () => {
    it('should generate valid Argon2id hash for valid password', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$argon2id$')).toBe(true);
      expect(hash).not.toBe(password);
    });

    it('should successfully verify matching password against Argon2id hash', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject non-matching password against Argon2id hash', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, 'WrongPassword123!');
      expect(isValid).toBe(false);
    });

    it('should fail closed when hash is NULL, undefined, or empty (e.g. dev user)', async () => {
      expect(await verifyPassword(null, 'SomePassword123!')).toBe(false);
      expect(await verifyPassword(undefined, 'SomePassword123!')).toBe(false);
      expect(await verifyPassword('', 'SomePassword123!')).toBe(false);
    });

    it('should fail closed when candidate password is empty or non-string', async () => {
      const hash = await hashPassword('ValidPass123!');
      expect(await verifyPassword(hash, null)).toBe(false);
      expect(await verifyPassword(hash, undefined)).toBe(false);
      expect(await verifyPassword(hash, '')).toBe(false);
    });

    it('should fail closed gracefully if hash string is malformed or corrupted', async () => {
      expect(await verifyPassword('$argon2id$invalid_corrupted_hash', 'Password123!')).toBe(false);
    });
  });
});
