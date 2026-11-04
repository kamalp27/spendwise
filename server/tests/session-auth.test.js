import { describe, it, expect, vi } from 'vitest';
import { sessionAuthMiddleware } from '../src/middleware/session-auth.js';
import { csrfProtection } from '../src/middleware/csrf.js';
import { signSessionId } from '../src/services/session.service.js';
import { env } from '../src/config/env.js';

describe('Production Session Authentication & CSRF Middleware', () => {
  describe('Session Authentication Middleware (sessionAuthMiddleware)', () => {
    it('should reject requests missing the session cookie with 401 UNAUTHENTICATED', async () => {
      const req = { cookies: {}, signedCookies: {} };
      const res = {};
      const next = vi.fn();

      await sessionAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHENTICATED');
      expect(req.user).toBeUndefined();
    });

    it('should reject requests with tampered session cookie with 401 UNAUTHENTICATED', async () => {
      const tamperedCookie = 's:tampered_session_id.invalid_hmac_signature';
      const req = {
        cookies: { [env.SESSION_COOKIE_NAME]: tamperedCookie },
        signedCookies: {}
      };
      const res = {};
      const next = vi.fn();

      await sessionAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHENTICATED');
    });

    it('should reject requests when session is expired or not found in database with 401 SESSION_EXPIRED', async () => {
      const validSid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const signedCookie = signSessionId(validSid, env.SESSION_SECRET);

      const mockDb = {
        query: vi.fn(async () => ({ rows: [] })) // No active session found
      };

      const req = {
        cookies: { [env.SESSION_COOKIE_NAME]: signedCookie },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };
      const res = {};
      const next = vi.fn();

      await sessionAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('SESSION_EXPIRED');
    });

    it('should reject requests for deactivated user accounts with 403 ACCOUNT_DEACTIVATED', async () => {
      const validSid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const signedCookie = signSessionId(validSid, env.SESSION_SECRET);

      const mockDb = {
        query: vi.fn(async (sql) => {
          if (sql.includes('SELECT')) {
            return {
              rows: [
                {
                  sid: validSid,
                  user_account_id: 'banned_user_1',
                  email: 'banned@spendwise.example',
                  display_name: 'Banned User',
                  currency: 'INR',
                  is_active: false // Deactivated account
                }
              ]
            };
          }
          return { rowCount: 1 };
        })
      };

      const req = {
        cookies: { [env.SESSION_COOKIE_NAME]: signedCookie },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };
      const res = {};
      const next = vi.fn();

      await sessionAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should attach verified user identity to req.user and call next() on valid session', async () => {
      const validSid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const signedCookie = signSessionId(validSid, env.SESSION_SECRET);
      const userId = 'verified-user-uuid-1';

      const mockDb = {
        query: vi.fn(async () => ({
          rows: [
            {
              sid: validSid,
              user_account_id: userId,
              email: 'verified@spendwise.example',
              display_name: 'Verified User',
              currency: 'INR',
              is_active: true
            }
          ]
        }))
      };

      const req = {
        cookies: { [env.SESSION_COOKIE_NAME]: signedCookie },
        signedCookies: {},
        headers: { 'x-user-id': 'attacker_spoofed_id' }, // Attacker header
        query: { userId: 'attacker_query_id' }, // Attacker query param
        app: { locals: { db: mockDb } }
      };
      const res = {};
      const next = vi.fn();

      await sessionAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userId);
      expect(req.user.id).not.toBe('attacker_spoofed_id');
      expect(req.user.id).not.toBe('attacker_query_id');
      expect(req.user.email).toBe('verified@spendwise.example');
      expect(req.sessionId).toBe(validSid);
    });

    describe('Bearer Token Fallback Authentication (Dual Authentication)', () => {
      it('should successfully authenticate with valid signed Bearer token when cookie is absent', async () => {
        const validSid = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
        const signedBearerToken = signSessionId(validSid, env.SESSION_SECRET);
        const userId = 'bearer-user-uuid-1';

        const mockDb = {
          query: vi.fn(async () => ({
            rows: [
              {
                sid: validSid,
                user_account_id: userId,
                email: 'bearer@spendwise.example',
                display_name: 'Bearer User',
                currency: 'INR',
                is_active: true
              }
            ]
          }))
        };

        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: `Bearer ${signedBearerToken}`
          },
          app: { locals: { db: mockDb } }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(userId);
        expect(req.user.email).toBe('bearer@spendwise.example');
        expect(req.sessionId).toBe(validSid);
      });

      it('should reject malformed Bearer token with 401 UNAUTHENTICATED', async () => {
        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: 'Bearer not_a_valid_signed_token'
          }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHENTICATED');
      });

      it('should reject tampered Bearer token with 401 UNAUTHENTICATED', async () => {
        const tamperedBearer = 's:valid_sid_with_bad_signature.invalid_hmac';
        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: `Bearer ${tamperedBearer}`
          }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHENTICATED');
      });

      it('should reject non-Bearer scheme or empty Bearer token with 401 UNAUTHENTICATED', async () => {
        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: 'Basic dXNlcjpwYXNz'
          }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHENTICATED');
      });

      it('should reject expired or revoked Bearer session with 401 SESSION_EXPIRED', async () => {
        const validSid = 'expired0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
        const signedBearerToken = signSessionId(validSid, env.SESSION_SECRET);

        const mockDb = {
          query: vi.fn(async () => ({ rows: [] }))
        };

        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: `Bearer ${signedBearerToken}`
          },
          app: { locals: { db: mockDb } }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('SESSION_EXPIRED');
      });

      it('should reject deactivated account via Bearer authentication with 403 ACCOUNT_DEACTIVATED', async () => {
        const validSid = 'deactivated0123456789abcdef0123456789abcdef0123456789abcdef012345';
        const signedBearerToken = signSessionId(validSid, env.SESSION_SECRET);

        const mockDb = {
          query: vi.fn(async (sql) => {
            if (sql.includes('SELECT')) {
              return {
                rows: [
                  {
                    sid: validSid,
                    user_account_id: 'deactivated_user_2',
                    email: 'deactivated@spendwise.example',
                    display_name: 'Deactivated User',
                    currency: 'INR',
                    is_active: false
                  }
                ]
              };
            }
            return { rowCount: 1 };
          })
        };

        const req = {
          cookies: {},
          signedCookies: {},
          headers: {
            authorization: `Bearer ${signedBearerToken}`
          },
          app: { locals: { db: mockDb } }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('ACCOUNT_DEACTIVATED');
      });

      it('should prioritize valid session cookie when both cookie and Bearer token are provided', async () => {
        const cookieSid = 'cookiesid0123456789abcdef0123456789abcdef0123456789abcdef01234567';
        const bearerSid = 'bearersid0123456789abcdef0123456789abcdef0123456789abcdef01234567';

        const signedCookie = signSessionId(cookieSid, env.SESSION_SECRET);
        const signedBearerToken = signSessionId(bearerSid, env.SESSION_SECRET);

        const mockDb = {
          query: vi.fn(async (sql, params) => {
            const requestedSid = params[0];
            return {
              rows: [
                {
                  sid: requestedSid,
                  user_account_id: requestedSid === cookieSid ? 'cookie-user' : 'bearer-user',
                  email: `${requestedSid}@spendwise.example`,
                  display_name: 'User',
                  currency: 'INR',
                  is_active: true
                }
              ]
            };
          })
        };

        const req = {
          cookies: { [env.SESSION_COOKIE_NAME]: signedCookie },
          signedCookies: {},
          headers: {
            authorization: `Bearer ${signedBearerToken}`
          },
          app: { locals: { db: mockDb } }
        };
        const res = {};
        const next = vi.fn();

        await sessionAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.sessionId).toBe(cookieSid);
        expect(req.user.id).toBe('cookie-user');
      });
    });
  });

  describe('CSRF Protection Middleware (csrfProtection)', () => {
    it('should permit safe HTTP methods (GET, HEAD, OPTIONS) without custom header', () => {
      ['GET', 'HEAD', 'OPTIONS'].forEach((method) => {
        const req = { method, headers: {} };
        const res = {};
        const next = vi.fn();

        csrfProtection(req, res, next);
        expect(next).toHaveBeenCalledWith();
      });
    });

    it('should reject state-changing HTTP requests missing custom header with 403', () => {
      ['POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
        const req = { method, headers: {} };
        const res = {};
        const next = vi.fn();

        csrfProtection(req, res, next);
        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('CSRF_VALIDATION_FAILED');
      });
    });

    it('should permit state-changing HTTP requests providing X-Requested-With or X-SpendWise-CSRF', () => {
      const req1 = {
        method: 'POST',
        headers: { 'x-requested-with': 'XMLHttpRequest' }
      };
      const next1 = vi.fn();
      csrfProtection(req1, {}, next1);
      expect(next1).toHaveBeenCalledWith();

      const req2 = {
        method: 'POST',
        headers: { 'x-spendwise-csrf': '1' }
      };
      const next2 = vi.fn();
      csrfProtection(req2, {}, next2);
      expect(next2).toHaveBeenCalledWith();
    });

    it('should reject request when Origin header does not match CLIENT_URL', () => {
      const req = {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://malicious-website.com'
        }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('should permit request when Origin header matches CLIENT_URL', () => {
      const req = {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should permit request with missing Origin if valid custom header is present', () => {
      const req = {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest'
          // No Origin header
        }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request when Origin header is "null"', () => {
      const req = {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'null' // sandboxed iframe or file origin
        }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('should normalize trailing slashes on allowed Origin matching', () => {
      const req = {
        method: 'POST',
        headers: {
          'x-spendwise-csrf': '1',
          origin: `${env.CLIENT_URL}///`
        }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
