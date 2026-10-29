import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Signs a session ID using HMAC SHA-256.
 * Format: "s:<sid>.<base64_hmac>"
 */
export function signSessionId(sid, secret = env.SESSION_SECRET) {
  if (!sid || typeof sid !== 'string') {
    throw new Error('Invalid sid: must be a non-empty string.');
  }
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${sid}.${hmac}`;
}

/**
 * Verifies and unsigns a signed session cookie value.
 * Returns the raw sid if the signature is valid, or null if tampered/invalid.
 */
export function unsignSessionId(signedCookie, secret = env.SESSION_SECRET) {
  if (!signedCookie || typeof signedCookie !== 'string') {
    return null;
  }

  if (!signedCookie.startsWith('s:')) {
    return null;
  }

  const dotIndex = signedCookie.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const sid = signedCookie.slice(2, dotIndex);
  const providedSignature = signedCookie.slice(dotIndex + 1);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return sid;
}

/**
 * Returns standard security attributes for session cookies.
 */
export function getSessionCookieOptions(isProduction = env.isProduction) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.SESSION_MAX_AGE_MS,
    path: '/'
  };
}

/**
 * Returns cookie clearing options matching session cookie attributes.
 */
export function getClearCookieOptions(isProduction = env.isProduction) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/'
  };
}

export class SessionService {
  /**
   * Generates a cryptographically random, unpredictable session identifier (64 hex characters / 256 bits).
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates and persists a new server-side session in PostgreSQL.
   */
  static async createSession(db, userId, payload = {}, req = null) {
    const sid = this.generateSessionId();
    const expire = new Date(Date.now() + env.SESSION_MAX_AGE_MS);
    const sessionPayload = {
      userId,
      ...payload,
      userAgent: req?.headers?.['user-agent'] || null,
      createdAt: new Date().toISOString()
    };

    const query = `
      INSERT INTO user_sessions (sid, sess, expire, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING sid, expire;
    `;

    await db.query(query, [sid, JSON.stringify(sessionPayload), expire, userId]);

    return {
      sid,
      signedCookie: signSessionId(sid),
      expire
    };
  }

  /**
   * Retrieves and verifies an active session and its associated user from PostgreSQL.
   */
  static async getSession(db, sid) {
    if (!sid || typeof sid !== 'string') {
      return null;
    }

    const query = `
      SELECT
        s.sid,
        s.sess,
        s.expire,
        s.user_id,
        u.id AS user_account_id,
        u.email,
        u.display_name,
        u.currency,
        u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.sid = $1 AND s.expire > CURRENT_TIMESTAMP;
    `;

    const { rows } = await db.query(query, [sid]);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Deactivated account check
    if (!row.is_active) {
      // Invalidate active sessions for deactivated account
      await this.revokeSession(db, sid);
      return { inactive: true, user: null };
    }

    return {
      sid: row.sid,
      expire: row.expire,
      user: {
        id: row.user_account_id,
        email: row.email,
        displayName: row.display_name,
        currency: row.currency,
        isActive: row.is_active
      }
    };
  }

  /**
   * Regenerates session identity (session fixation prevention).
   * Revokes the old session and creates a fresh session.
   */
  static async regenerateSession(db, oldSid, userId, payload = {}, req = null) {
    if (oldSid) {
      await this.revokeSession(db, oldSid);
    }
    return this.createSession(db, userId, payload, req);
  }

  /**
   * Revokes a single session by identifier.
   */
  static async revokeSession(db, sid) {
    if (!sid || typeof sid !== 'string') {
      return false;
    }

    const query = `DELETE FROM user_sessions WHERE sid = $1;`;
    const res = await db.query(query, [sid]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Revokes all active sessions for a given user (e.g. password change).
   */
  static async revokeAllUserSessions(db, userId) {
    if (!userId) return 0;
    const query = `DELETE FROM user_sessions WHERE user_id = $1;`;
    const res = await db.query(query, [userId]);
    return res.rowCount || 0;
  }

  /**
   * Cleans up all expired sessions.
   */
  static async cleanupExpiredSessions(db) {
    const query = `DELETE FROM user_sessions WHERE expire <= CURRENT_TIMESTAMP;`;
    const res = await db.query(query);
    return res.rowCount || 0;
  }
}
