import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import { Duplex } from 'stream';
import express from 'express';
import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { signSessionId } from '../src/services/session.service.js';
import { env } from '../src/config/env.js';

const VALID_SID = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
const VALID_COOKIE = signSessionId(VALID_SID, env.SESSION_SECRET);
const AUTH_COOKIE = `${env.SESSION_COOKIE_NAME}=${VALID_COOKIE}`;

const AUTH_USER = {
  id: 'usr-auth-session-1234',
  email: 'session.user@spendwise.example',
  displayName: 'Session Authenticated User',
  currency: 'INR'
};

function dispatch(app, { method, url, headers = {}, body = null, rawBody = null }) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:5000', ...headers };

    const socket = new Duplex({
      read() {},
      write(chunk, enc, cb) {
        cb();
      }
    });
    socket.remoteAddress = '127.0.0.1';
    req.socket = socket;

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

    if (rawBody !== null && rawBody !== undefined) {
      req.headers['content-length'] = Buffer.byteLength(rawBody);
      req.push(Buffer.from(rawBody));
      req.push(null);
    } else if (body !== null && body !== undefined) {
      if (typeof body === 'string') {
        req.headers['content-length'] = Buffer.byteLength(body);
        req.push(Buffer.from(body));
        req.push(null);
      } else {
        req.body = body;
      }
    }

    app.handle(req, res);
  });
}

describe('Middleware & Security Behavior', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(async (sql, params = []) => {
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
        return { rows: [{ '?column?': 1 }] };
      })
    };
    app.locals.db = mockDb;
  });

  describe('Not Found (404) Handler', () => {
    it('should return HTTP 404 with a predictable JSON envelope for undefined routes', async () => {
      const response = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/non-existent-route',
        headers: { cookie: AUTH_COOKIE }
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Resource not found: GET /api/v1/non-existent-route',
          code: 'NOT_FOUND'
        }
      });
    });
  });

  describe('Malformed JSON Handler', () => {
    it('should return HTTP 400 with a clean error when invalid JSON body is sent', async () => {
      const response = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/health',
        headers: { 'content-type': 'application/json' },
        rawBody: '{ "invalidJson": broken '
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Malformed JSON in request body',
          code: 'BAD_REQUEST'
        }
      });
    });
  });

  describe('Production Error Masking', () => {
    let originalNodeEnv;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should mask 500 error messages and never leak stack traces in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/error-test', (req, res, next) => {
        next(new Error('Sensitive database credentials leak test'));
      });
      testApp.use(errorHandler);

      const response = await dispatch(testApp, { method: 'GET', url: '/error-test' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.stack).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('Sensitive database credentials');
    });
  });

  describe('CORS Restrictions', () => {
    it('should permit requests from the configured CLIENT_URL', async () => {
      const response = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'http://localhost:5173' }
      });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should block requests from unauthorized origins', async () => {
      const response = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'https://malicious-external-site.com' }
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Origin not allowed by CORS policy',
          code: 'FORBIDDEN'
        }
      });
    });
  });
});
