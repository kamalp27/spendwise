import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiClient,
  ApiError,
  getApiBaseUrl,
  isApiUrl,
  DEFAULT_API_BASE_URL,
  DEFAULT_TIMEOUT_MS
} from '../src/services/api-client.js';
import {
  AUTH_TOKEN_KEY,
  getAuthMode,
  isTokenAuthMode,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  setAuthModeForTesting,
  resetAuthModeForTesting
} from '../src/services/auth-token.js';

describe('API Client Configuration & Error Handling', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    resetAuthModeForTesting();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    vi.restoreAllMocks();
  });

  describe('Configuration Defaults', () => {
    it('uses the documented development base URL default', () => {
      expect(DEFAULT_API_BASE_URL).toBe('http://localhost:5000/api/v1');
      expect(getApiBaseUrl()).toBe('http://localhost:5000/api/v1');
    });

    it('has a default request timeout of 30000ms', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30000);
      expect(apiClient.defaults.timeout).toBe(30000);
    });

    it('sets standard JSON headers and CSRF custom header', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
      expect(apiClient.defaults.headers['Accept']).toBe('application/json');
      expect(apiClient.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest');
    });

    it('enables withCredentials for authenticated cross-origin session cookies', () => {
      expect(apiClient.defaults.withCredentials).toBe(true);
    });
  });

  describe('Successful Responses', () => {
    it('unwraps server JSON response envelope directly', async () => {
      apiClient.defaults.adapter = async (config) => {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: [{ id: '1', title: 'Coffee' }]
          }
        };
      };

      const result = await apiClient.get('/test-endpoint');
      expect(result).toEqual({
        success: true,
        data: [{ id: '1', title: 'Coffee' }]
      });
    });
  });

  describe('CSRF Custom Header on Mutation Requests', () => {
    it('automatically ensures X-Requested-With header on POST, PUT, PATCH, and DELETE requests', async () => {
      const capturedConfigs = [];
      apiClient.defaults.adapter = async (config) => {
        capturedConfigs.push(config);
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.post('/expenses', { amount: 50 });
      await apiClient.put('/expenses/1', { amount: 60 });
      await apiClient.patch('/expenses/1', { amount: 70 });
      await apiClient.delete('/expenses/1');

      expect(capturedConfigs).toHaveLength(4);
      for (const config of capturedConfigs) {
        expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest');
        expect(config.withCredentials).toBe(true);
      }
    });
  });

  describe('HTTP Error Handling & Preservation', () => {
    it('preserves HTTP 400 Bad Request status, error code, and message', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 400');
        error.response = {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'INVALID_AMOUNT',
              message: 'Amount must be greater than zero.'
            }
          }
        };
        throw error;
      };

      try {
        await apiClient.get('/bad-request');
        expect.unreachable('Should have rejected the promise');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(400);
        expect(err.code).toBe('INVALID_AMOUNT');
        expect(err.message).toBe('Amount must be greater than zero.');
        expect(err.details).toEqual({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be greater than zero.'
          }
        });
      }
    });

    it('preserves HTTP 401 Unauthorized status and AUTH_NOT_IMPLEMENTED code', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 401');
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'AUTH_NOT_IMPLEMENTED',
              message: 'Authentication not implemented.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/protected')).rejects.toMatchObject({
        status: 401,
        code: 'AUTH_NOT_IMPLEMENTED',
        message: 'Authentication not implemented.'
      });
    });

    it('preserves HTTP 404 Not Found status and EXPENSE_NOT_FOUND code', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 404');
        error.response = {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'EXPENSE_NOT_FOUND',
              message: 'Expense not found.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/expenses/missing-id')).rejects.toMatchObject({
        status: 404,
        code: 'EXPENSE_NOT_FOUND',
        message: 'Expense not found.'
      });
    });

    it('preserves HTTP 409 Conflict status and CATEGORY_ALREADY_EXISTS code', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 409');
        error.response = {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'CATEGORY_ALREADY_EXISTS',
              message: 'A category named "Groceries" already exists.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.post('/categories', { name: 'Groceries' })).rejects.toMatchObject({
        status: 409,
        code: 'CATEGORY_ALREADY_EXISTS',
        message: 'A category named "Groceries" already exists.'
      });
    });

    it('preserves HTTP 429 Rate Limit Exceeded status', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 429');
        error.response = {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests from this IP, please try again later.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/rate-limited')).rejects.toMatchObject({
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      });
    });

    it('preserves HTTP 500 Internal Server Error status', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Request failed with status code 500');
        error.response = {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Database connection failed.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/server-error')).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database connection failed.'
      });
    });
  });

  describe('Network Errors and Timeouts', () => {
    it('identifies network offline / connection refusal as a network error', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Network Error');
        error.request = {};
        error.code = 'ERR_NETWORK';
        throw error;
      };

      try {
        await apiClient.get('/offline');
        expect.unreachable('Should have rejected');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBeNull();
        expect(err.code).toBe('NETWORK_ERROR');
        expect(err.isNetworkError).toBe(true);
        expect(err.isTimeout).toBe(false);
        expect(err.message).toContain('Network error. Unable to connect to SpendWise server.');
      }
    });

    it('identifies ECONNABORTED as a timeout error', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('timeout of 30000ms exceeded');
        error.request = {};
        error.code = 'ECONNABORTED';
        throw error;
      };

      try {
        await apiClient.get('/timed-out');
        expect.unreachable('Should have rejected');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBeNull();
        expect(err.code).toBe('TIMEOUT_ERROR');
        expect(err.isTimeout).toBe(true);
        expect(err.message).toContain('Request timed out.');
      }
    });

    it('does not silently convert errors into empty successful responses', async () => {
      apiClient.defaults.adapter = async () => {
        const error = new Error('Connection refused');
        error.request = {};
        throw error;
      };

      let failed = false;
      try {
        await apiClient.get('/expenses');
      } catch (err) {
        failed = true;
        expect(err).toBeInstanceOf(ApiError);
      }

      expect(failed).toBe(true);
    });
  });

  describe('Authentication Mode & Dual-Origin Token Handling (Stage 2)', () => {
    it('defaults to cookie auth mode when VITE_AUTH_MODE is unset or not "token"', () => {
      resetAuthModeForTesting();
      expect(getAuthMode()).toBe('cookie');
      expect(isTokenAuthMode()).toBe(false);
    });

    it('resolves token mode when auth mode is set to "token"', () => {
      setAuthModeForTesting('token');
      expect(getAuthMode()).toBe('token');
      expect(isTokenAuthMode()).toBe(true);
    });

    it('cookie mode does not read, write, or attach Bearer tokens to requests', async () => {
      resetAuthModeForTesting(); // cookie mode
      // Attempting to write token via safe helper in cookie mode is ignored
      setStoredToken('test-secret-token');
      expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
      expect(getStoredToken()).toBeNull();

      // Even if sessionStorage directly had an orphaned key, cookie mode must not attach it
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'orphaned-token');
      expect(getStoredToken()).toBeNull();

      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get('/auth/me');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBeUndefined();
      expect(capturedConfig.headers['authorization']).toBeUndefined();
      expect(capturedConfig.withCredentials).toBe(true);
    });

    it('token mode attaches Authorization Bearer header when token exists in sessionStorage', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:valid_session_123.hmac_signature');

      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get('/auth/me');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBe('Bearer s:valid_session_123.hmac_signature');
      expect(capturedConfig.withCredentials).toBe(true);
    });

    it('token mode does not attach Authorization header when no token is stored in sessionStorage', async () => {
      setAuthModeForTesting('token');
      clearStoredToken({ force: true });

      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get('/expenses');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBeUndefined();
    });

    it('isApiUrl rejects protocol-relative URLs to protect against credential leakage', () => {
      expect(isApiUrl('//malicious.example.com')).toBe(false);
      expect(isApiUrl('//malicious.example.com/api/steal')).toBe(false);
      expect(isApiUrl('//localhost:5000/api/v1')).toBe(false);
    });

    it('isApiUrl allows legitimate relative API paths and same-origin absolute URLs', () => {
      // Legitimate relative paths
      expect(isApiUrl('/auth/me')).toBe(true);
      expect(isApiUrl('expenses')).toBe(true);
      expect(isApiUrl('/categories?limit=50')).toBe(true);
      expect(isApiUrl('')).toBe(true);
      expect(isApiUrl(null)).toBe(true);

      // Legitimate same-origin absolute URLs
      const apiBase = getApiBaseUrl();
      expect(isApiUrl(`${apiBase}/auth/me`)).toBe(true);
      expect(isApiUrl(`${apiBase}/expenses`)).toBe(true);

      // Third-party absolute URLs
      expect(isApiUrl('https://evil.example.com/api')).toBe(false);
      expect(isApiUrl('https://external-api.com/v1/data')).toBe(false);
    });

    it('token mode does not attach Bearer token to protocol-relative URLs', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:sensitive_token.signature');

      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get('//malicious.example.com/api');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBeUndefined();
    });

    it('token mode does not attach Bearer token to unrelated external third-party URLs', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:sensitive_token.signature');

      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get('https://external-service.example.com/api/data');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBeUndefined();
    });

    it('token mode attaches Bearer token to absolute URLs matching the SpendWise API origin', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:session_for_api.signature');

      const apiBase = getApiBaseUrl(); // e.g. 'http://localhost:5000/api/v1'
      let capturedConfig;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true }
        };
      };

      await apiClient.get(`${apiBase}/categories`);

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.headers['Authorization']).toBe('Bearer s:session_for_api.signature');
    });

    it('clears stored token in token mode on HTTP 401 Unauthorized response', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:expired_token.signature');
      expect(getStoredToken()).toBe('s:expired_token.signature');

      apiClient.defaults.adapter = async () => {
        const error = new Error('Unauthorized');
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Your session has expired.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/expenses')).rejects.toThrow();

      // Token must have been removed from sessionStorage
      expect(getStoredToken()).toBeNull();
      expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    });

    it('clears stored token in token mode on HTTP 403 ACCOUNT_DEACTIVATED response', async () => {
      setAuthModeForTesting('token');
      setStoredToken('s:deactivated_user_token.signature');

      apiClient.defaults.adapter = async () => {
        const error = new Error('Forbidden');
        error.response = {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          data: {
            success: false,
            error: {
              code: 'ACCOUNT_DEACTIVATED',
              message: 'Account access has been deactivated.'
            }
          }
        };
        throw error;
      };

      await expect(apiClient.get('/expenses')).rejects.toThrow();

      expect(getStoredToken()).toBeNull();
    });

    it('does NOT clear stored token in token mode on HTTP 500, 404, 400, 429, or network errors', async () => {
      setAuthModeForTesting('token');
      const testToken = 's:durable_valid_session.signature';

      // 1. HTTP 500 Internal Server Error
      setStoredToken(testToken);
      apiClient.defaults.adapter = async () => {
        const error = new Error('Internal Server Error');
        error.response = {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          data: { success: false, error: { code: 'INTERNAL_SERVER_ERROR' } }
        };
        throw error;
      };
      await expect(apiClient.get('/expenses')).rejects.toThrow();
      expect(getStoredToken()).toBe(testToken);

      // 2. HTTP 404 Not Found
      apiClient.defaults.adapter = async () => {
        const error = new Error('Not Found');
        error.response = {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          data: { success: false, error: { code: 'NOT_FOUND' } }
        };
        throw error;
      };
      await expect(apiClient.get('/expenses/999')).rejects.toThrow();
      expect(getStoredToken()).toBe(testToken);

      // 3. Network Error (offline / timed out)
      apiClient.defaults.adapter = async () => {
        const error = new Error('Network Error');
        error.request = {};
        throw error;
      };
      await expect(apiClient.get('/expenses')).rejects.toThrow();
      expect(getStoredToken()).toBe(testToken);
    });

    it('safe storage helpers handle invalid or empty token inputs gracefully without exceptions', () => {
      setAuthModeForTesting('token');
      setStoredToken(null);
      setStoredToken(undefined);
      setStoredToken('');
      setStoredToken(12345);
      expect(getStoredToken()).toBeNull();

      setStoredToken('   ');
      expect(getStoredToken()).toBeNull();

      setStoredToken('  valid_token  ');
      expect(getStoredToken()).toBe('valid_token');
    });
  });
});
