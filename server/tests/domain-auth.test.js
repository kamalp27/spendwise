import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signSessionId } from '../src/services/session.service.js';

const VALID_SID = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
const VALID_COOKIE = signSessionId(VALID_SID, env.SESSION_SECRET);
const AUTH_COOKIE = `${env.SESSION_COOKIE_NAME}=${VALID_COOKIE}`;

const AUTH_USER = {
  id: 'usr-auth-session-1234',
  email: 'session.user@spendwise.example',
  displayName: 'Session Authenticated User',
  currency: 'INR'
};

function dispatch(app, { method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:5000', ...headers };
    req.socket = { remoteAddress: '127.0.0.1' };
    if (body) {
      req.body = body;
    }

    let responseData = '';
    const responseHeaders = {};
    const res = new http.ServerResponse(req);
    res.setHeader = (k, v) => {
      responseHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => responseHeaders[k.toLowerCase()];
    res.write = (chunk) => {
      if (chunk) responseData += chunk;
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      let parsed = responseData;
      try {
        parsed = JSON.parse(responseData);
      } catch (_) {}
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        body: parsed
      });
    };

    app.handle(req, res);
  });
}

describe('Domain Routes Session Authentication & Scoping (Stage 6.2D5)', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = {
      query: vi.fn(async (sql, params = []) => {
        // Session lookup query
        if (sql.includes('user_sessions')) {
          if (params[0] === VALID_SID) {
            return {
              rows: [
                {
                  sid: VALID_SID,
                  sess: {},
                  expire: new Date(Date.now() + 86400000),
                  user_id: AUTH_USER.id,
                  user_account_id: AUTH_USER.id,
                  email: AUTH_USER.email,
                  display_name: AUTH_USER.displayName,
                  currency: AUTH_USER.currency,
                  is_active: true
                }
              ]
            };
          }
          return { rows: [] };
        }

        // Domain table queries
        if (sql.includes('COUNT(*) AS total')) {
          return { rows: [{ total: '0' }] };
        }
        if (sql.includes('SELECT') && sql.includes('categories')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT') && sql.includes('budgets')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT') && sql.includes('expenses')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO expenses')) {
          return {
            rows: [
              {
                id: 'exp-created-1',
                user_id: params[0],
                title: params[1],
                amount: params[2],
                date: params[3],
                payment_method: params[4]
              }
            ]
          };
        }
        return { rows: [] };
      })
    };
    app.locals.db = mockDb;
  });

  describe('1. Unauthenticated Requests to Protected Financial Routes are Rejected', () => {
    it('rejects unauthenticated GET /api/v1/expenses with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated GET /api/v1/categories with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/categories'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated GET /api/v1/budgets with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/budgets?month=10&year=2026'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated GET /api/v1/analytics/summary with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/analytics/summary?month=10&year=2026'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated POST /api/v1/expenses with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: { title: 'Coffee', amount: 4.5, payment_method: 'Cash', date: '2026-10-29' }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated PATCH /api/v1/expenses/:id with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: '/api/v1/expenses/exp-uuid-1',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: { amount: 10 }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated DELETE /api/v1/expenses/:id with 401 UNAUTHENTICATED', async () => {
      const res = await dispatch(app, {
        method: 'DELETE',
        url: '/api/v1/expenses/exp-uuid-1',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('2. Invalid, Expired, or Tampered Sessions are Rejected', () => {
    it('rejects tampered cookie signature with 401 UNAUTHENTICATED', async () => {
      const tamperedCookie = `${env.SESSION_COOKIE_NAME}=s:${VALID_SID}.forged_signature`;

      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: tamperedCookie
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects session not found or expired in database with 401 SESSION_EXPIRED', async () => {
      const unknownSid = '9999888877776666555544443333222211110000ffffbbbbccccddddeeeeffff';
      const signedCookie = signSessionId(unknownSid, env.SESSION_SECRET);

      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: `${env.SESSION_COOKIE_NAME}=${signedCookie}`
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    });

    it('rejects deactivated user account with 403 ACCOUNT_DEACTIVATED', async () => {
      mockDb.query.mockImplementation(async (sql, params = []) => {
        if (sql.includes('user_sessions')) {
          if (sql.includes('DELETE FROM user_sessions')) {
            return { rows: [] };
          }
          return {
            rows: [
              {
                sid: VALID_SID,
                sess: {},
                expire: new Date(Date.now() + 86400000),
                user_id: 'usr-deactivated',
                user_account_id: 'usr-deactivated',
                email: 'deactivated@spendwise.example',
                display_name: 'Deactivated User',
                currency: 'INR',
                is_active: false
              }
            ]
          };
        }
        return { rows: [] };
      });

      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE
        }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    });
  });

  describe('3. Authenticated Sessions & Strict Identity Isolation', () => {
    it('permits valid authenticated session to access GET /api/v1/expenses', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('strictly derives user scoping from session and ignores caller-supplied identity headers or body', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL,
          // Attacker attempting to spoof user identity via header
          'x-user-id': 'attacker-uuid-666',
          authorization: 'Bearer spoofed-token'
        },
        body: {
          title: 'Scoped Expense',
          amount: 25.0,
          date: '2026-10-29',
          payment_method: 'UPI',
          // Attacker attempting to spoof user identity in body
          userId: 'attacker-uuid-666',
          user_id: 'attacker-uuid-666'
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify that database insertion query was called strictly with the session user's ID
      const insertCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO expenses')
      );
      expect(insertCall).toBeDefined();
      const insertParams = insertCall[1];
      expect(insertParams[0]).toBe(AUTH_USER.id); // Must match session user, NOT attacker-uuid-666
      expect(insertParams[0]).not.toBe('attacker-uuid-666');
    });

    it('enforces CSRF validation for state-changing requests even when authenticated', async () => {
      // Authenticated session, but missing required CSRF custom header
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE,
          'content-type': 'application/json',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'No CSRF Header',
          amount: 50,
          date: '2026-10-29',
          payment_method: 'Cash'
        }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });
  });

  describe('4. Public & Non-Domain Endpoints Remain Unaffected', () => {
    it('public health endpoint GET /api/v1/health remains accessible without session', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/health'
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('preflight OPTIONS on domain route succeeds without session cookie', async () => {
      const res = await dispatch(app, {
        method: 'OPTIONS',
        url: '/api/v1/expenses',
        headers: {
          origin: env.CLIENT_URL,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, X-Requested-With'
        }
      });

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
    });
  });
});
