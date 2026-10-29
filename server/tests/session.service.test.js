import { describe, it, expect, vi } from 'vitest';
import {
  SessionService,
  signSessionId,
  unsignSessionId,
  getSessionCookieOptions,
  getClearCookieOptions
} from '../src/services/session.service.js';

describe('Server-Side Session Foundation (SessionService)', () => {
  describe('Cryptographic Session ID Generation & Cookie Signing', () => {
    it('should generate a 64-hex character (256-bit) unpredictable session ID', () => {
      const sid1 = SessionService.generateSessionId();
      const sid2 = SessionService.generateSessionId();

      expect(sid1).toMatch(/^[0-9a-f]{64}$/);
      expect(sid2).toMatch(/^[0-9a-f]{64}$/);
      expect(sid1).not.toBe(sid2);
    });

    it('should correctly sign and unsign session identifiers', () => {
      const sid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const secret = 'test-secret-at-least-32-characters-long!';

      const signed = signSessionId(sid, secret);
      expect(signed.startsWith('s:' + sid + '.')).toBe(true);

      const recovered = unsignSessionId(signed, secret);
      expect(recovered).toBe(sid);
    });

    it('should reject tampered or modified signed session cookie', () => {
      const sid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const secret = 'test-secret-at-least-32-characters-long!';

      const signed = signSessionId(sid, secret);
      const tampered = signed.slice(0, -2) + 'xy';

      expect(unsignSessionId(tampered, secret)).toBeNull();
    });

    it('should reject cookie signed with different secret', () => {
      const sid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const secretA = 'test-secret-a-at-least-32-characters-long!';
      const secretB = 'test-secret-b-at-least-32-characters-long!';

      const signed = signSessionId(sid, secretA);
      expect(unsignSessionId(signed, secretB)).toBeNull();
    });

    it('should reject malformed or non-cookie strings', () => {
      expect(unsignSessionId('not-a-cookie')).toBeNull();
      expect(unsignSessionId('s:missingdot')).toBeNull();
      expect(unsignSessionId(null)).toBeNull();
      expect(unsignSessionId(undefined)).toBeNull();
    });
  });

  describe('Cookie Security Attributes', () => {
    it('should configure httpOnly, lax sameSite, and path on session cookie', () => {
      const optionsDev = getSessionCookieOptions(false);
      expect(optionsDev.httpOnly).toBe(true);
      expect(optionsDev.sameSite).toBe('lax');
      expect(optionsDev.secure).toBe(false);
      expect(optionsDev.path).toBe('/');
      expect(optionsDev.maxAge).toBeGreaterThan(0);

      const optionsProd = getSessionCookieOptions(true);
      expect(optionsProd.secure).toBe(true);
    });

    it('should configure clear cookie options matching session cookie path and sameSite', () => {
      const clearOptions = getClearCookieOptions(false);
      expect(clearOptions.httpOnly).toBe(true);
      expect(clearOptions.path).toBe('/');
      expect(clearOptions.sameSite).toBe('lax');
    });
  });

  describe('Database Session Storage Operations', () => {
    it('should create and store a session with 7-day expiration', async () => {
      const executed = [];
      const mockDb = {
        query: vi.fn(async (sql, params) => {
          executed.push({ sql: sql.trim(), params });
          return { rows: [{ sid: params[0], expire: params[2] }] };
        })
      };

      const userId = '00000000-0000-0000-0000-000000000001';
      const session = await SessionService.createSession(mockDb, userId, { role: 'user' }, {
        headers: { 'user-agent': 'Vitest-Agent' }
      });

      expect(session.sid).toMatch(/^[0-9a-f]{64}$/);
      expect(session.signedCookie.startsWith('s:' + session.sid)).toBe(true);
      expect(session.expire.getTime()).toBeGreaterThan(Date.now());

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sid, sessStr, expire, userFk] = executed[0].params;
      expect(sid).toBe(session.sid);
      expect(userFk).toBe(userId);
      const parsedSess = JSON.parse(sessStr);
      expect(parsedSess.userId).toBe(userId);
      expect(parsedSess.userAgent).toBe('Vitest-Agent');
    });

    it('should retrieve active session and return joined user profile', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const sid = 'session123456';

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          return {
            rows: [
              {
                sid,
                sess: { userId },
                expire: new Date(Date.now() + 100000),
                user_id: userId,
                user_account_id: userId,
                email: 'test@spendwise.example',
                display_name: 'Test User',
                currency: 'INR',
                is_active: true
              }
            ]
          };
        })
      };

      const session = await SessionService.getSession(mockDb, sid);
      expect(session).toBeDefined();
      expect(session.sid).toBe(sid);
      expect(session.user.id).toBe(userId);
      expect(session.user.email).toBe('test@spendwise.example');
      expect(session.user.isActive).toBe(true);
    });

    it('should return null when session is not found or expired', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      const session = await SessionService.getSession(mockDb, 'expired_or_invalid_sid');
      expect(session).toBeNull();
    });

    it('should revoke session and return inactive indicator when user account is deactivated', async () => {
      const sid = 'session_deactivated_user';
      const queries = [];

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          queries.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT')) {
            return {
              rows: [
                {
                  sid,
                  sess: {},
                  expire: new Date(Date.now() + 100000),
                  user_id: 'user123',
                  user_account_id: 'user123',
                  email: 'deactivated@spendwise.example',
                  display_name: 'Banned User',
                  currency: 'INR',
                  is_active: false
                }
              ]
            };
          }
          return { rowCount: 1 };
        })
      };

      const session = await SessionService.getSession(mockDb, sid);
      expect(session.inactive).toBe(true);
      expect(session.user).toBeNull();

      // Verify deletion query was triggered to revoke session
      const deleteQuery = queries.find((q) => q.sql.includes('DELETE FROM user_sessions'));
      expect(deleteQuery).toBeDefined();
      expect(deleteQuery.params).toEqual([sid]);
    });

    it('should revoke existing session on regenerateSession', async () => {
      const oldSid = 'old_session_id';
      const userId = 'user_id_1';
      const executed = [];

      const mockDb = {
        query: vi.fn(async (sql, params) => {
          executed.push({ sql: sql.trim(), params });
          return { rows: [{ sid: 'new_session_id', expire: new Date() }], rowCount: 1 };
        })
      };

      const newSession = await SessionService.regenerateSession(mockDb, oldSid, userId);
      expect(newSession).toBeDefined();

      const deleteQuery = executed.find((q) => q.sql.includes('DELETE FROM user_sessions'));
      expect(deleteQuery).toBeDefined();
      expect(deleteQuery.params).toEqual([oldSid]);
    });

    it('should delete record on revokeSession', async () => {
      const sid = 'session_to_delete';
      const mockDb = {
        query: vi.fn(async (sql, params) => ({ rowCount: 1 }))
      };

      const revoked = await SessionService.revokeSession(mockDb, sid);
      expect(revoked).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sessions WHERE sid = $1'),
        [sid]
      );
    });

    it('should delete all user sessions on revokeAllUserSessions', async () => {
      const userId = 'user_with_multiple_devices';
      const mockDb = {
        query: vi.fn(async (sql, params) => ({ rowCount: 3 }))
      };

      const count = await SessionService.revokeAllUserSessions(mockDb, userId);
      expect(count).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sessions WHERE user_id = $1'),
        [userId]
      );
    });
  });
});
