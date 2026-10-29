import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../src/services/auth.service.js';
import { hashPassword } from '../src/utils/password.js';

describe('Authentication Service (AuthService)', () => {
  describe('Email Normalization & Validation', () => {
    it('should trim and convert valid email to lowercase', () => {
      expect(AuthService.normalizeEmail('  User.Name@Example.COM ')).toBe('user.name@example.com');
      expect(AuthService.normalizeEmail('test+alias@spendwise.org')).toBe('test+alias@spendwise.org');
    });

    it('should reject invalid or missing email formats', () => {
      expect(() => AuthService.normalizeEmail('')).toThrowError(/Email is required/);
      expect(() => AuthService.normalizeEmail('plainaddress')).toThrowError(/Invalid email format/);
      expect(() => AuthService.normalizeEmail('@missingusername.com')).toThrowError(/Invalid email format/);
      expect(() => AuthService.normalizeEmail('username@.com')).toThrowError(/Invalid email format/);
    });
  });

  describe('User Registration', () => {
    it('should register a new user, hash password with Argon2id, and return safe profile', async () => {
      const executed = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          executed.push({ sql: sql.trim(), params });
          return {
            rows: [
              {
                id: 'new-user-uuid-1234',
                email: params[0],
                display_name: params[2],
                currency: params[3],
                is_active: true,
                created_at: new Date('2026-10-29T12:00:00Z')
              }
            ]
          };
        })
      };

      const result = await AuthService.register(mockDb, {
        email: '  Jane.Doe@SpendWise.Example ',
        password: 'ValidPassword123!',
        displayName: 'Jane Doe',
        currency: 'INR'
      });

      expect(result.id).toBe('new-user-uuid-1234');
      expect(result.email).toBe('jane.doe@spendwise.example');
      expect(result.displayName).toBe('Jane Doe');
      expect(result.currency).toBe('INR');
      expect(result.password_hash).toBeUndefined();
      expect(result.password).toBeUndefined();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [emailParam, hashParam, nameParam] = executed[0].params;
      expect(emailParam).toBe('jane.doe@spendwise.example');
      expect(hashParam.startsWith('$argon2id$')).toBe(true);
      expect(nameParam).toBe('Jane Doe');
    });

    it('should catch unique violation error 23505 and throw 409 Conflict', async () => {
      const mockDb = {
        query: vi.fn(async () => {
          const err = new Error('duplicate key value violates unique constraint "idx_users_email_lower"');
          err.code = '23505';
          throw err;
        })
      };

      await expect(
        AuthService.register(mockDb, {
          email: 'duplicate@spendwise.example',
          password: 'ValidPassword123!',
          displayName: 'Duplicate User'
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'EMAIL_ALREADY_EXISTS'
      });
    });

    it('should reject weak passwords during registration', async () => {
      const mockDb = { query: vi.fn() };

      await expect(
        AuthService.register(mockDb, {
          email: 'user@spendwise.example',
          password: 'weak',
          displayName: 'User'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'PASSWORD_TOO_SHORT'
      });

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('User Login', () => {
    it('should successfully authenticate valid credentials and update last_login_at', async () => {
      const plainPassword = 'CorrectPassword123!';
      const storedHash = await hashPassword(plainPassword);
      const userId = 'user-auth-uuid-5678';
      const executed = [];

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          executed.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT')) {
            return {
              rows: [
                {
                  id: userId,
                  email: 'login.user@spendwise.example',
                  password_hash: storedHash,
                  display_name: 'Login User',
                  currency: 'INR',
                  is_active: true
                }
              ]
            };
          }
          if (sql.includes('UPDATE users SET last_login_at')) {
            return { rowCount: 1 };
          }
          return { rows: [] };
        })
      };

      const user = await AuthService.login(mockDb, {
        email: 'LOGIN.USER@spendwise.example',
        password: plainPassword
      });

      expect(user.id).toBe(userId);
      expect(user.email).toBe('login.user@spendwise.example');
      expect(user.displayName).toBe('Login User');
      expect(user.password_hash).toBeUndefined();

      // Verify update last_login_at query was executed
      const updateQuery = executed.find((q) => q.sql.includes('UPDATE users SET last_login_at'));
      expect(updateQuery).toBeDefined();
      expect(updateQuery.params).toEqual([userId]);
    });

    it('should reject non-matching password with 401 INVALID_CREDENTIALS', async () => {
      const storedHash = await hashPassword('CorrectPassword123!');
      const mockDb = {
        query: vi.fn(async () => ({
          rows: [
            {
              id: 'user1',
              email: 'test@spendwise.example',
              password_hash: storedHash,
              is_active: true
            }
          ]
        }))
      };

      await expect(
        AuthService.login(mockDb, {
          email: 'test@spendwise.example',
          password: 'WrongPassword123!'
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should fail closed when user email is unknown with 401 INVALID_CREDENTIALS', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      await expect(
        AuthService.login(mockDb, {
          email: 'nonexistent@spendwise.example',
          password: 'AnyPassword123!'
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should fail closed when password_hash is NULL (e.g. seeded development user)', async () => {
      const mockDb = {
        query: vi.fn(async () => ({
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'dev.user@spendwise.example',
              password_hash: null, // Seeded user has no password
              is_active: true
            }
          ]
        }))
      };

      await expect(
        AuthService.login(mockDb, {
          email: 'dev.user@spendwise.example',
          password: 'SomeAttemptedPassword123!'
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should reject deactivated account with 403 ACCOUNT_DEACTIVATED', async () => {
      const plainPassword = 'ValidPassword123!';
      const storedHash = await hashPassword(plainPassword);

      const mockDb = {
        query: vi.fn(async () => ({
          rows: [
            {
              id: 'deactivated_user',
              email: 'banned@spendwise.example',
              password_hash: storedHash,
              is_active: false
            }
          ]
        }))
      };

      await expect(
        AuthService.login(mockDb, {
          email: 'banned@spendwise.example',
          password: plainPassword
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_DEACTIVATED'
      });
    });
  });

  describe('User Profile Retrieval', () => {
    it('should return safe user profile fields', async () => {
      const mockDb = {
        query: vi.fn(async () => ({
          rows: [
            {
              id: 'user_123',
              email: 'profile@spendwise.example',
              display_name: 'Profile User',
              currency: 'INR',
              is_active: true,
              created_at: new Date('2026-10-29T10:00:00Z'),
              last_login_at: new Date('2026-10-29T14:00:00Z')
            }
          ]
        }))
      };

      const profile = await AuthService.getProfile(mockDb, 'user_123');
      expect(profile.id).toBe('user_123');
      expect(profile.email).toBe('profile@spendwise.example');
      expect(profile.displayName).toBe('Profile User');
      expect(profile.currency).toBe('INR');
      expect(profile.createdAt).toBeDefined();
      expect(profile.lastLoginAt).toBeDefined();
    });

    it('should reject profile request when account is missing or inactive', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      await expect(AuthService.getProfile(mockDb, 'missing_id')).rejects.toMatchObject({
        statusCode: 401,
        code: 'USER_NOT_FOUND'
      });
    });
  });
});
