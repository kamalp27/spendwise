import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiClient,
  ApiError,
  getApiBaseUrl,
  DEFAULT_API_BASE_URL,
  DEFAULT_TIMEOUT_MS
} from '../src/services/api-client.js';

describe('API Client Configuration & Error Handling', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  describe('Configuration Defaults', () => {
    it('uses the documented development base URL default', () => {
      expect(DEFAULT_API_BASE_URL).toBe('http://localhost:5000/api/v1');
      expect(getApiBaseUrl()).toBe('http://localhost:5000/api/v1');
    });

    it('has a default request timeout of 10000ms', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10000);
      expect(apiClient.defaults.timeout).toBe(10000);
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
        const error = new Error('timeout of 10000ms exceeded');
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
});
