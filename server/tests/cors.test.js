import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('CORS Configuration (In-Memory Middleware Test)', () => {
  const app = createApp();
  const corsLayer = app._router.stack.find((layer) => layer.name === 'corsMiddleware');

  it('corsMiddleware is registered in the express middleware stack', () => {
    expect(corsLayer).toBeDefined();
    expect(typeof corsLayer.handle).toBe('function');
  });

  it('includes PATCH in Access-Control-Allow-Methods for preflight OPTIONS requests', () => {
    const headersSet = {};
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: env.CLIENT_URL,
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'Content-Type'
      }
    };
    const res = {
      setHeader: vi.fn((key, value) => {
        headersSet[key.toLowerCase()] = value;
      }),
      getHeader: vi.fn((key) => headersSet[key.toLowerCase()]),
      statusCode: 200,
      end: vi.fn()
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    const allowMethods = headersSet['access-control-allow-methods'];
    expect(allowMethods).toBeDefined();
    expect(allowMethods).toContain('PATCH');
    expect(allowMethods).toContain('GET');
    expect(allowMethods).toContain('POST');
    expect(allowMethods).toContain('PUT');
    expect(allowMethods).toContain('DELETE');
    expect(allowMethods).toContain('OPTIONS');
  });

  it('allows X-Requested-With and X-SpendWise-CSRF custom headers in preflight OPTIONS requests', () => {
    const headersSet = {};
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: env.CLIENT_URL,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, X-Requested-With, X-SpendWise-CSRF'
      }
    };
    const res = {
      setHeader: vi.fn((key, value) => {
        headersSet[key.toLowerCase()] = value;
      }),
      getHeader: vi.fn((key) => headersSet[key.toLowerCase()]),
      statusCode: 200,
      end: vi.fn()
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    const allowHeaders = headersSet['access-control-allow-headers'];
    expect(allowHeaders).toBeDefined();
    expect(allowHeaders).toContain('X-Requested-With');
    expect(allowHeaders).toContain('X-SpendWise-CSRF');
    expect(allowHeaders).toContain('Content-Type');
  });

  it('strictly sets exact origin without wildcard and enables credentials', () => {
    const headersSet = {};
    const req = {
      method: 'GET',
      headers: {
        origin: env.CLIENT_URL
      }
    };
    const res = {
      setHeader: vi.fn((key, value) => {
        headersSet[key.toLowerCase()] = value;
      }),
      getHeader: vi.fn((key) => headersSet[key.toLowerCase()])
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(headersSet['access-control-allow-origin']).toBe(env.CLIENT_URL);
    expect(headersSet['access-control-allow-origin']).not.toBe('*');
    expect(headersSet['access-control-allow-credentials']).toBe('true');
  });

  it('sets Access-Control-Allow-Origin and credentials for authorized client origin', () => {
    const headersSet = {};
    const req = {
      method: 'GET',
      headers: {
        origin: env.CLIENT_URL
      }
    };
    const res = {
      setHeader: vi.fn((key, value) => {
        headersSet[key.toLowerCase()] = value;
      }),
      getHeader: vi.fn((key) => headersSet[key.toLowerCase()])
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(headersSet['access-control-allow-origin']).toBe(env.CLIENT_URL);
    expect(headersSet['access-control-allow-credentials']).toBe('true');
  });

  it('allows requests with no origin header (server-to-server or tools)', () => {
    const headersSet = {};
    const req = {
      method: 'GET',
      headers: {}
    };
    const res = {
      setHeader: vi.fn((key, value) => {
        headersSet[key.toLowerCase()] = value;
      }),
      getHeader: vi.fn((key) => headersSet[key.toLowerCase()])
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(headersSet['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects disallowed origins with a CORS error', () => {
    const headersSet = {};
    const req = {
      method: 'GET',
      headers: {
        origin: 'http://malicious-site.example.com'
      }
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn()
    };
    const next = vi.fn();

    corsLayer.handle(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('CORS origin not allowed');
  });
});
