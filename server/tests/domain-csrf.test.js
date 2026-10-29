import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signSessionId } from '../src/services/session.service.js';

const VALID_SID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const VALID_COOKIE = signSessionId(VALID_SID, env.SESSION_SECRET);
const AUTH_COOKIE_HEADER = `${env.SESSION_COOKIE_NAME}=${VALID_COOKIE}`;

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

describe('Domain Routes CSRF Protection & Preflights (Stage 6.2D2 / 6.2D5)', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = {
      query: vi.fn(async (sql, params = []) => {
        if (sql.includes('user_sessions')) {
          return {
            rows: [
              {
                sid: VALID_SID,
                sess: {},
                expire: new Date(Date.now() + 86400000),
                user_id: '00000000-0000-0000-0000-000000000001',
                user_account_id: '00000000-0000-0000-0000-000000000001',
                email: 'test@spendwise.example',
                display_name: 'Test User',
                currency: 'INR',
                is_active: true
              }
            ]
          };
        }
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
        if (sql.includes('INSERT') || sql.includes('UPDATE') || sql.includes('DELETE')) {
          return { rows: [{ id: '00000000-0000-0000-0000-000000000001' }] };
        }
        return { rows: [] };
      })
    };
    app.locals.db = mockDb;
  });

  describe('1. Missing CSRF Custom Header on Domain Mutations', () => {
    it('rejects POST /api/v1/expenses missing custom header with 403 CSRF_VALIDATION_FAILED', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          origin: env.CLIENT_URL
        },
        body: { title: 'Test Expense', amount: 50 }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('rejects PATCH /api/v1/expenses/:id missing custom header with 403 CSRF_VALIDATION_FAILED', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: '/api/v1/expenses/00000000-0000-0000-0000-000000000001',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          origin: env.CLIENT_URL
        },
        body: { amount: 75 }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('rejects DELETE /api/v1/expenses/:id missing custom header with 403 CSRF_VALIDATION_FAILED', async () => {
      const res = await dispatch(app, {
        method: 'DELETE',
        url: '/api/v1/expenses/00000000-0000-0000-0000-000000000001',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          origin: env.CLIENT_URL
        }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('rejects POST /api/v1/categories missing custom header with 403 CSRF_VALIDATION_FAILED', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/categories',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          origin: env.CLIENT_URL
        },
        body: { name: 'New Category', color: '#10B981' }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('rejects POST /api/v1/budgets missing custom header with 403 CSRF_VALIDATION_FAILED', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/budgets',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          origin: env.CLIENT_URL
        },
        body: { amount: 500, month: 10, year: 2026 }
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });
  });

  describe('2. Disallowed Origin Rejection on Mutations', () => {
    it('rejects mutation when Origin header is from an unauthorized domain', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://malicious-attacker.com'
        },
        body: { title: 'Attacker Expense', amount: 10, payment_method: 'Cash', date: '2026-10-29' }
      });

      // Handled and rejected at transport boundary (CORS/CSRF) with 403 Forbidden
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Safe Read-Only Methods Pass Without CSRF Header', () => {
    it('permits GET /api/v1/expenses without custom header', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE_HEADER
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('permits GET /api/v1/categories without custom header', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/categories',
        headers: {
          cookie: AUTH_COOKIE_HEADER
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('permits GET /api/v1/budgets without custom header', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/budgets?month=10&year=2026',
        headers: {
          cookie: AUTH_COOKIE_HEADER
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('permits GET /api/v1/analytics/summary without custom header', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/analytics/summary?month=10&year=2026',
        headers: {
          cookie: AUTH_COOKIE_HEADER
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Valid CSRF Custom Header Allows Mutations', () => {
    it('permits POST with X-Requested-With header from allowed origin', async () => {
      // Mock category access check and expense insertion
      mockDb.query.mockImplementation(async (sql, params = []) => {
        if (sql.includes('user_sessions')) {
          return {
            rows: [
              {
                sid: VALID_SID,
                sess: {},
                expire: new Date(Date.now() + 86400000),
                user_id: '00000000-0000-0000-0000-000000000001',
                user_account_id: '00000000-0000-0000-0000-000000000001',
                email: 'test@spendwise.example',
                display_name: 'Test User',
                currency: 'INR',
                is_active: true
              }
            ]
          };
        }
        if (sql.includes('INSERT INTO expenses')) {
          return {
            rows: [
              {
                id: 'exp-123',
                user_id: '00000000-0000-0000-0000-000000000001',
                title: 'Groceries',
                amount: '120.50',
                date: '2026-10-29',
                payment_method: 'UPI'
              }
            ]
          };
        }
        return { rows: [] };
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'Groceries',
          amount: 120.5,
          date: '2026-10-29',
          payment_method: 'UPI'
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('exp-123');
    });

    it('permits POST with X-SpendWise-CSRF header from allowed origin', async () => {
      mockDb.query.mockImplementation(async (sql, params = []) => {
        if (sql.includes('user_sessions')) {
          return {
            rows: [
              {
                sid: VALID_SID,
                sess: {},
                expire: new Date(Date.now() + 86400000),
                user_id: '00000000-0000-0000-0000-000000000001',
                user_account_id: '00000000-0000-0000-0000-000000000001',
                email: 'test@spendwise.example',
                display_name: 'Test User',
                currency: 'INR',
                is_active: true
              }
            ]
          };
        }
        if (sql.includes('INSERT INTO expenses')) {
          return {
            rows: [
              {
                id: 'exp-456',
                user_id: '00000000-0000-0000-0000-000000000001',
                title: 'Book',
                amount: '45.00',
                date: '2026-10-29',
                payment_method: 'Cash'
              }
            ]
          };
        }
        return { rows: [] };
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: AUTH_COOKIE_HEADER,
          'content-type': 'application/json',
          'x-spendwise-csrf': '1',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'Book',
          amount: 45.0,
          date: '2026-10-29',
          payment_method: 'Cash'
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('exp-456');
    });
  });

  describe('5. Preflight OPTIONS Handling', () => {
    it('handles CORS preflight OPTIONS on domain routes cleanly', async () => {
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
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-headers']).toContain('X-Requested-With');
    });
  });
});
