import { AuthService } from '../services/auth.service.js';
import {
  SessionService,
  getSessionCookieOptions,
  getClearCookieOptions,
  unsignSessionId
} from '../services/session.service.js';
import { getPool } from '../db/pool.js';
import { env } from '../config/env.js';

/**
 * Safely extracts and verifies the session identifier from an incoming request.
 * Prioritizes the HTTP-only signed session cookie, falling back to Authorization: Bearer.
 *
 * @param {Object} req - Express request
 * @returns {string | null} Verified raw session ID, or null if absent/invalid
 */
function extractSessionIdFromRequest(req) {
  let rawCookie = req.cookies?.[env.SESSION_COOKIE_NAME];
  let sid = req.signedCookies?.[env.SESSION_COOKIE_NAME] || null;
  if (!sid && rawCookie) {
    sid = unsignSessionId(rawCookie, env.SESSION_SECRET);
  }

  if (!sid) {
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.slice(7).trim();
      if (rawToken) {
        sid = unsignSessionId(rawToken, env.SESSION_SECRET);
      }
    }
  }

  return sid;
}

export class AuthController {
  /**
   * Registers a new account and immediately establishes an authenticated session.
   */
  static async register(req, res, next) {
    try {
      const db = req.app?.locals?.db || getPool();
      const user = await AuthService.register(db, req.body);

      // Extract existing session ID if any for safe rotation and revocation
      const oldSid = extractSessionIdFromRequest(req);

      // Issue a fresh session ID and revoke any previous session
      const session = await SessionService.regenerateSession(db, oldSid, user.id, {}, req);
      res.cookie(
        env.SESSION_COOKIE_NAME,
        session.signedCookie,
        getSessionCookieOptions(env.isProduction)
      );

      res.status(201).json({
        success: true,
        data: {
          ...user,
          token: session.signedCookie
        }
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
      const oldSid = extractSessionIdFromRequest(req);

      const session = await SessionService.regenerateSession(db, oldSid, user.id, {}, req);
      res.cookie(
        env.SESSION_COOKIE_NAME,
        session.signedCookie,
        getSessionCookieOptions(env.isProduction)
      );

      res.status(200).json({
        success: true,
        data: {
          ...user,
          token: session.signedCookie
        }
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

      const sid = req.sessionId || extractSessionIdFromRequest(req);

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
