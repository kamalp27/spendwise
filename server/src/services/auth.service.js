import { AppError } from '../utils/app-error.js';
import { validateString } from '../utils/validation.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Precomputed static Argon2id hash for constant-time dummy verification when user is unknown
// or password_hash is NULL. Never represents a real user account.
const DUMMY_ARGON2ID_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$k1wXtYKt5Jtpnf73JgmWeA$4vkndET5oL1y44i7gldr5uHr+0g8tWwSJdiXWnra+44';

export class AuthService {
  /**
   * Normalizes an email address by trimming and converting to lowercase.
   */
  static normalizeEmail(email) {
    if (typeof email !== 'string') {
      throw AppError.badRequest('Email must be a text string.', 'INVALID_EMAIL');
    }
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length === 0) {
      throw AppError.badRequest('Email is required.', 'MISSING_EMAIL');
    }
    if (trimmed.length > 255) {
      throw AppError.badRequest('Email cannot exceed 255 characters.', 'EMAIL_TOO_LONG');
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      throw AppError.badRequest('Invalid email format.', 'INVALID_EMAIL_FORMAT');
    }
    return trimmed;
  }

  /**
   * Registers a new user account with Argon2id hashed password.
   */
  static async register(db, data) {
    const { email, password, displayName, currency = 'INR' } = data || {};

    const cleanEmail = this.normalizeEmail(email);
    validatePasswordStrength(password);
    const cleanDisplayName = validateString(displayName, {
      min: 1,
      max: 100,
      required: true,
      fieldName: 'displayName'
    });

    const cleanCurrency = typeof currency === 'string' && currency.trim().length === 3
      ? currency.trim().toUpperCase()
      : 'INR';

    const passwordHash = await hashPassword(password);

    const query = `
      INSERT INTO users (
        email,
        password_hash,
        display_name,
        currency,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, display_name, currency, is_active, created_at, updated_at;
    `;

    try {
      const { rows } = await db.query(query, [
        cleanEmail,
        passwordHash,
        cleanDisplayName,
        cleanCurrency
      ]);

      const user = rows[0];
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        currency: user.currency,
        createdAt: user.created_at
      };
    } catch (err) {
      // PostgreSQL unique constraint violation on idx_users_email_lower
      if (err.code === '23505') {
        throw AppError.conflict(
          'An account with this email address is already registered.',
          'EMAIL_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  }

  /**
   * Authenticates user credentials and verifies account active status.
   */
  static async login(db, data) {
    const { email, password } = data || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw AppError.badRequest('Email and password are required.', 'MISSING_CREDENTIALS');
    }

    const cleanEmail = email.trim().toLowerCase();

    const query = `
      SELECT
        id,
        email,
        password_hash,
        display_name,
        currency,
        is_active
      FROM users
      WHERE LOWER(email) = $1;
    `;

    const { rows } = await db.query(query, [cleanEmail]);

    // Execute dummy Argon2id calculation to reduce timing discrepancy against email enumeration
    if (rows.length === 0 || !rows[0].password_hash) {
      await verifyPassword(DUMMY_ARGON2ID_HASH, password);
      throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const user = rows[0];

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw AppError.forbidden(
        'This account has been deactivated. Please contact support.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Update last_login_at timestamp asynchronously
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      currency: user.currency
    };
  }

  /**
   * Retrieves safe user profile fields by user ID.
   */
  static async getProfile(db, userId) {
    if (!userId) {
      throw AppError.unauthorized('Authentication required.', 'UNAUTHENTICATED');
    }

    const query = `
      SELECT
        id,
        email,
        display_name,
        currency,
        is_active,
        created_at,
        last_login_at
      FROM users
      WHERE id = $1;
    `;

    const { rows } = await db.query(query, [userId]);
    if (rows.length === 0 || !rows[0].is_active) {
      throw AppError.unauthorized('User not found or account deactivated.', 'USER_NOT_FOUND');
    }

    const user = rows[0];
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      currency: user.currency,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    };
  }
}
