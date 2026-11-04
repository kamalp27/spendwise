import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';
import { getPool } from '../db/pool.js';
import { SessionService, unsignSessionId } from '../services/session.service.js';

/**
 * Production Session Authentication Middleware
 *
 * Enforces server-side session validation backed by PostgreSQL:
 * 1. Extracts signed session cookie (spendwise.sid).
 * 2. Unsigns and verifies cookie integrity using HMAC SHA-256.
 * 3. Fetches active session from PostgreSQL, validating expiration and active account status.
 * 4. Binds verified user identity strictly to req.user (Object.freeze).
 * 5. Rejects missing, expired, invalid, or tampered sessions with HTTP 401 Unauthorized.
 */
export async function sessionAuthMiddleware(req, res, next) {
  try {
    let rawCookie = req.cookies?.[env.SESSION_COOKIE_NAME];
    let sid = req.signedCookies?.[env.SESSION_COOKIE_NAME] || null;

    if (!sid && rawCookie) {
      sid = unsignSessionId(rawCookie, env.SESSION_SECRET);
    }

    // Fallback: Check for Bearer token in Authorization header when session cookie is absent
    if (!sid) {
      const authHeader = req.headers?.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const rawToken = authHeader.slice(7).trim();
        if (rawToken) {
          sid = unsignSessionId(rawToken, env.SESSION_SECRET);
        }
      }
    }

    if (!sid) {
      return next(
        AppError.unauthorized(
          'Authentication required. No valid session found.',
          'UNAUTHENTICATED'
        )
      );
    }

    const db = req.app?.locals?.db || getPool();
    const session = await SessionService.getSession(db, sid);

    if (!session) {
      return next(
        AppError.unauthorized(
          'Session has expired or is invalid. Please log in again.',
          'SESSION_EXPIRED'
        )
      );
    }

    if (session.inactive || !session.user) {
      return next(
        AppError.forbidden(
          'This account has been deactivated. Access denied.',
          'ACCOUNT_DEACTIVATED'
        )
      );
    }

    // Attach verified user identity and session ID to request
    req.user = Object.freeze({
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      currency: session.user.currency
    });
    req.sessionId = sid;

    next();
  } catch (err) {
    // Fail closed on database or operational errors
    next(err);
  }
}
