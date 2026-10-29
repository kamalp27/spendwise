import { describe, it, expect, vi } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { HealthController } from '../src/controllers/health.controller.js';

function dispatch(app, { method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:5000', ...headers };
    req.socket = {
      remoteAddress: '127.0.0.1',
      destroy: () => {}
    };
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

describe('Health Endpoint (GET /api/v1/health)', () => {
  it('should import the app without starting a network listener', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    // Verify it is not listening on a port by default
    expect(app.listening).toBeUndefined();
  });

  // End-to-end HTTP integration test via in-memory Express dispatch
  it('should return HTTP 200 with the documented status and service name', async () => {
    const origUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const response = await dispatch(app, { method: 'GET', url: '/api/v1/health' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'spendwise-api',
        database: 'unconfigured'
      });
    } finally {
      if (origUrl !== undefined) {
        process.env.DATABASE_URL = origUrl;
      }
    }
  });

  describe('Deterministic In-Memory Health Controller Tests', () => {
    it('returns 200 with database: unconfigured when no database is configured', async () => {
      const origUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      const req = { app: { locals: {} } };
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status: vi.fn((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn((data) => {
          jsonBody = data;
          return res;
        })
      };

      try {
        await HealthController.getHealth(req, res);

        expect(statusCode).toBe(200);
        expect(jsonBody).toEqual({
          status: 'ok',
          service: 'spendwise-api',
          database: 'unconfigured'
        });
      } finally {
        if (origUrl !== undefined) {
          process.env.DATABASE_URL = origUrl;
        }
      }
    });

    it('returns 200 with database: connected when probe query succeeds', async () => {
      const mockDb = {
        query: vi.fn(async (sql) => {
          expect(sql).toBe('SELECT 1');
          return { rows: [{ '?column?': 1 }] };
        })
      };

      const req = { app: { locals: { db: mockDb } } };
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status: vi.fn((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn((data) => {
          jsonBody = data;
          return res;
        })
      };

      await HealthController.getHealth(req, res);

      expect(mockDb.query).toHaveBeenCalledWith('SELECT 1');
      expect(statusCode).toBe(200);
      expect(jsonBody).toEqual({
        status: 'ok',
        service: 'spendwise-api',
        database: 'connected'
      });
    });

    it('returns 503 degraded status and never leaks credentials when probe query fails', async () => {
      const sensitiveErrorMessage =
        'FATAL: password authentication failed for user "neondb_owner:secret_password_123" at 192.168.1.10:5432';
      const mockDb = {
        query: vi.fn(async () => {
          throw new Error(sensitiveErrorMessage);
        })
      };

      // Spy on console.error to suppress test stderr
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = { app: { locals: { db: mockDb } } };
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status: vi.fn((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn((data) => {
          jsonBody = data;
          return res;
        })
      };

      await HealthController.getHealth(req, res);

      expect(statusCode).toBe(503);
      expect(jsonBody).toEqual({
        status: 'degraded',
        service: 'spendwise-api',
        database: 'disconnected',
        error: 'Database connectivity check failed'
      });

      // Verify sensitive details are NOT present anywhere in HTTP response
      const responseString = JSON.stringify(jsonBody);
      expect(responseString).not.toContain('secret_password_123');
      expect(responseString).not.toContain('neondb_owner');
      expect(responseString).not.toContain('192.168.1.10');
      expect(responseString).not.toContain('FATAL');

      consoleErrorSpy.mockRestore();
    });
  });
});
