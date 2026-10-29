import argon2 from 'argon2';
import { AppError } from './app-error.js';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

const PASSWORD_RULES = [
  { test: (pw) => /[a-z]/.test(pw), message: 'at least one lowercase letter' },
  { test: (pw) => /[A-Z]/.test(pw), message: 'at least one uppercase letter' },
  { test: (pw) => /[0-9]/.test(pw), message: 'at least one number' }
];

/**
 * Enforces server-side password validation rules.
 * @param {string} password
 * @throws {AppError} if password fails strength requirements
 */
export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw AppError.badRequest('Password is required.', 'MISSING_PASSWORD');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw AppError.badRequest(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      'PASSWORD_TOO_SHORT'
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw AppError.badRequest(
      `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`,
      'PASSWORD_TOO_LONG'
    );
  }

  const missingRules = PASSWORD_RULES.filter((rule) => !rule.test(password)).map(
    (rule) => rule.message
  );

  if (missingRules.length > 0) {
    throw AppError.badRequest(
      `Password must contain ${missingRules.join(', ')}.`,
      'PASSWORD_TOO_WEAK'
    );
  }

  return password;
}

/**
 * Hashes a plaintext password using Argon2id.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The Argon2id formatted hash string.
 */
export async function hashPassword(password) {
  validatePasswordStrength(password);
  return argon2.hash(password, {
    type: argon2.argon2id
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Fails closed if the hash is null, undefined, not a string, or verification fails.
 *
 * @param {string|null|undefined} hash - The stored password hash.
 * @param {string} plainPassword - The plaintext candidate password.
 * @returns {Promise<boolean>} True if matching, false otherwise.
 */
export async function verifyPassword(hash, plainPassword) {
  if (!hash || typeof hash !== 'string' || !plainPassword || typeof plainPassword !== 'string') {
    return false;
  }

  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // Fail closed on any malformed hash or verification error
    return false;
  }
}
