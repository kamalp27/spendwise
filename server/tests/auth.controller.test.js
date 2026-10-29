import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../src/controllers/auth.controller.js';
import { AuthService } from '../src/services/auth.service.js';
import { SessionService, signSessionId } from '../src/services/session.service.js';
import { env } from '../src/config/env.js';

describe('Auth Controller & Registration Session Lifecycle (Task 2)', () => {
  let mockDb;
  let res;
  let next;
  let cookiesSet;
  let cookiesCleared;

  beforeEach(() => {
    mockDb = {
      query: vi.fn()
    };

    cookiesSet = {};
    cookiesCleared = {};

    res = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
      cookie: vi.fn((name, val, opts) => {
        cookiesSet[name] = { val, opts };
      }),
      clearCookie: vi.fn((name, opts) => {
        cookiesCleared[name] = opts;
      })
    };

    next = vi.fn();
  });

  describe('Registration Session Lifecycle', () => {
    it('should register a new user without an existing session and set session cookie', async () => {
      const newUser = {
        id: 'new-user-1',
        email: 'new@spendwise.example',
        displayName: 'New User',
        currency: 'INR'
      };

      vi.spyOn(AuthService, 'register').mockResolvedValue(newUser);
      vi.spyOn(SessionService, 'regenerateSession').mockResolvedValue({
        sid: 'fresh_session_sid_1',
        signedCookie: 's:fresh_session_sid_1.valid_hmac',
        expire: new Date(Date.now() + 600000)
      });

      const req = {
        body: {
          email: 'new@spendwise.example',
          password: 'ValidPassword123!',
          displayName: 'New User'
        },
        cookies: {},
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.register(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(newUser.id);

      // Verify regenerateSession was called with null oldSid (no prior session)
      expect(SessionService.regenerateSession).toHaveBeenCalledWith(
        mockDb,
        null,
        newUser.id,
        {},
        req
      );

      // Verify cookie was set with httpOnly
      expect(cookiesSet[env.SESSION_COOKIE_NAME]).toBeDefined();
      expect(cookiesSet[env.SESSION_COOKIE_NAME].val).toBe('s:fresh_session_sid_1.valid_hmac');
      expect(cookiesSet[env.SESSION_COOKIE_NAME].opts.httpOnly).toBe(true);
    });

    it('should rotate session and revoke prior session when registering with an existing valid session', async () => {
      const priorSid = 'prior_existing_session_sid_99';
      const priorSignedCookie = signSessionId(priorSid, env.SESSION_SECRET);

      const registeredUser = {
        id: 'registered-user-2',
        email: 'rotated@spendwise.example',
        displayName: 'Rotated User',
        currency: 'INR'
      };

      vi.spyOn(AuthService, 'register').mockResolvedValue(registeredUser);
      vi.spyOn(SessionService, 'regenerateSession').mockResolvedValue({
        sid: 'new_fresh_session_sid_100',
        signedCookie: 's:new_fresh_session_sid_100.new_hmac',
        expire: new Date(Date.now() + 600000)
      });

      const req = {
        body: {
          email: 'rotated@spendwise.example',
          password: 'ValidPassword123!',
          displayName: 'Rotated User'
        },
        cookies: {
          [env.SESSION_COOKIE_NAME]: priorSignedCookie
        },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.register(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);

      // Verify old session ID was extracted and passed to regenerateSession for revocation
      expect(SessionService.regenerateSession).toHaveBeenCalledWith(
        mockDb,
        priorSid,
        registeredUser.id,
        {},
        req
      );

      // Verify newly issued cookie has new session ID
      expect(cookiesSet[env.SESSION_COOKIE_NAME].val).toBe('s:new_fresh_session_sid_100.new_hmac');
    });

    it('should safely handle malformed or tampered existing session cookie during registration', async () => {
      const registeredUser = {
        id: 'registered-user-3',
        email: 'tampered@spendwise.example',
        displayName: 'Tampered User',
        currency: 'INR'
      };

      vi.spyOn(AuthService, 'register').mockResolvedValue(registeredUser);
      vi.spyOn(SessionService, 'regenerateSession').mockResolvedValue({
        sid: 'fresh_clean_session_3',
        signedCookie: 's:fresh_clean_session_3.clean_hmac',
        expire: new Date(Date.now() + 600000)
      });

      const req = {
        body: {
          email: 'tampered@spendwise.example',
          password: 'ValidPassword123!',
          displayName: 'Tampered User'
        },
        cookies: {
          [env.SESSION_COOKIE_NAME]: 's:tampered_id.invalid_signature_xxx'
        },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.register(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);

      // Old sid is rejected as null due to invalid signature, but registration proceeds cleanly
      expect(SessionService.regenerateSession).toHaveBeenCalledWith(
        mockDb,
        null,
        registeredUser.id,
        {},
        req
      );
    });

    it('should not revoke existing session or issue new session if registration fails', async () => {
      const priorSid = 'safe_prior_session_sid';
      const priorSignedCookie = signSessionId(priorSid, env.SESSION_SECRET);

      const registrationError = new Error('Email already registered');
      registrationError.statusCode = 409;
      registrationError.code = 'EMAIL_ALREADY_EXISTS';

      vi.spyOn(AuthService, 'register').mockRejectedValue(registrationError);
      vi.spyOn(SessionService, 'regenerateSession');

      const req = {
        body: {
          email: 'existing@spendwise.example',
          password: 'ValidPassword123!',
          displayName: 'Existing User'
        },
        cookies: {
          [env.SESSION_COOKIE_NAME]: priorSignedCookie
        },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(registrationError);
      // Session regeneration must NOT be invoked if registration threw an error
      expect(SessionService.regenerateSession).not.toHaveBeenCalled();
      expect(cookiesSet[env.SESSION_COOKIE_NAME]).toBeUndefined();
    });
  });

  describe('Login & Logout Session Lifecycle', () => {
    it('should rotate session on login when existing session cookie is present', async () => {
      const priorSid = 'login_prior_session_sid';
      const priorSignedCookie = signSessionId(priorSid, env.SESSION_SECRET);

      const loggedInUser = {
        id: 'user-login-1',
        email: 'login@spendwise.example',
        displayName: 'Login User',
        currency: 'INR'
      };

      vi.spyOn(AuthService, 'login').mockResolvedValue(loggedInUser);
      vi.spyOn(SessionService, 'regenerateSession').mockResolvedValue({
        sid: 'new_login_sid',
        signedCookie: 's:new_login_sid.hmac',
        expire: new Date(Date.now() + 600000)
      });

      const req = {
        body: {
          email: 'login@spendwise.example',
          password: 'ValidPassword123!'
        },
        cookies: {
          [env.SESSION_COOKIE_NAME]: priorSignedCookie
        },
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.login(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(SessionService.regenerateSession).toHaveBeenCalledWith(
        mockDb,
        priorSid,
        loggedInUser.id,
        {},
        req
      );
    });

    it('should revoke active session from database and clear cookie on logout', async () => {
      const activeSid = 'logout_session_sid';
      vi.spyOn(SessionService, 'revokeSession').mockResolvedValue(true);

      const req = {
        sessionId: activeSid,
        cookies: {},
        signedCookies: {},
        app: { locals: { db: mockDb } }
      };

      await AuthController.logout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(SessionService.revokeSession).toHaveBeenCalledWith(mockDb, activeSid);
      expect(cookiesCleared[env.SESSION_COOKIE_NAME]).toBeDefined();
    });
  });
});
