import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { devAuthMiddleware } from '../src/middleware/dev-auth.js';
import { DEV_USER } from '../src/db/seed.js';

describe('Development Auth Middleware (Fail-Closed Policy)', () => {
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should grant access and attach DEV_USER when NODE_ENV is explicitly "development"', () => {
    process.env.NODE_ENV = 'development';

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(DEV_USER.id);
    expect(req.user.email).toBe(DEV_USER.email);
  });

  it('should grant access and attach DEV_USER when NODE_ENV is explicitly "test"', () => {
    process.env.NODE_ENV = 'test';

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(DEV_USER.id);
  });

  it('should strictly ignore client-supplied identity injection in allowed environments', () => {
    process.env.NODE_ENV = 'development';

    const req = {
      headers: { 'x-user-id': 'attacker-id-123' },
      query: { userId: 'attacker-query-id' }
    };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.id).toBe(DEV_USER.id);
    expect(req.user.id).not.toBe('attacker-id-123');
    expect(req.user.id).not.toBe('attacker-query-id');
  });

  it('should reject requests with 401 when NODE_ENV is "production"', () => {
    process.env.NODE_ENV = 'production';

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_NOT_IMPLEMENTED');
    expect(req.user).toBeUndefined();
  });

  it('should reject requests with 401 when NODE_ENV is "staging"', () => {
    process.env.NODE_ENV = 'staging';

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_NOT_IMPLEMENTED');
    expect(req.user).toBeUndefined();
  });

  it('should reject requests with 401 when NODE_ENV is unset (undefined)', () => {
    delete process.env.NODE_ENV;

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_NOT_IMPLEMENTED');
    expect(req.user).toBeUndefined();
  });

  it('should reject requests with 401 when NODE_ENV is empty string', () => {
    process.env.NODE_ENV = '';

    const req = { headers: {}, query: {} };
    const res = {};
    const next = vi.fn();

    devAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_NOT_IMPLEMENTED');
    expect(req.user).toBeUndefined();
  });
});
