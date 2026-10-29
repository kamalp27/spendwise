import { AuthService } from '../services/auth.service.js';
import {
  SessionService,
  getSessionCookieOptions,
  getClearCookieOptions,
  unsignSessionId
} from '../services/session.service.js';
import { getPool } from '../db/pool.js';
import { env } from '../config/env.js';

export class AuthController {
  /**
   * Registers a new account and immediately establishes an authenticated session.
   */
  static async register(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const user = await AuthService.register(db, req.body);

      // Extract existing session ID if any for safe rotation and revocation
      let rawCookie = req.cookies?.[env.SESSION_COOKIE_NAME];
      let oldSid = req.signedCookies?.[env.SESSION_COOKIE_NAME] || null;
      if (!oldSid && rawCookie) {
        oldSid = unsignSessionId(rawCookie, env.SESSION_SECRET);
      }

      // Issue a fresh session ID and revoke any previous session
      const session = await SessionService.regenerateSession(db, oldSid, user.id, {}, req);
      res.cookie(
        env.SESSION_COOKIE_NAME,
        session.signedCookie,
        getSessionCookieOptions(env.isProduction)
      );

      res.status(201).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Authenticates user credentials, regenerates session ID, and issues session cookie.
   */
  static async login(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const user = await AuthService.login(db, req.body);

      // Extract existing session ID if any for regeneration
      let rawCookie = req.cookies?.[env.SESSION_COOKIE_NAME];
      let oldSid = req.signedCookies?.[env.SESSION_COOKIE_NAME] || null;
      if (!oldSid && rawCookie) {
        oldSid = unsignSessionId(rawCookie, env.SESSION_SECRET);
      }

      const session = await SessionService.regenerateSession(db, oldSid, user.id, {}, req);
      res.cookie(
        env.SESSION_COOKIE_NAME,
        session.signedCookie,
        getSessionCookieOptions(env.isProduction)
      );

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes the active session in PostgreSQL and clears the client session cookie.
   */
  static async logout(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();

      let sid = req.sessionId;
      if (!sid) {
        const rawCookie = req.cookies?.[env.SESSION_COOKIE_NAME];
        sid = req.signedCookies?.[env.SESSION_COOKIE_NAME] || null;
        if (!sid && rawCookie) {
          sid = unsignSessionId(rawCookie, env.SESSION_SECRET);
        }
      }

      if (sid) {
        await SessionService.revokeSession(db, sid);
      }

      res.clearCookie(env.SESSION_COOKIE_NAME, getClearCookieOptions(env.isProduction));

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully.'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves profile of current authenticated user session.
   */
  static async getMe(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const user = await AuthService.getProfile(db, req.user.id);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }
}
