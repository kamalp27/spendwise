import axios from 'axios';
import { isTokenAuthMode, getStoredToken, clearStoredToken } from './auth-token.js';

export const DEFAULT_API_BASE_URL = 'http://localhost:5000/api/v1';
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Resolves and normalizes the backend API base URL from Vite environment variables.
 * Falls back to the documented development default (http://localhost:5000/api/v1).
 */
export function getApiBaseUrl() {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : undefined;

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

/**
 * Validates whether a request target URL points to the SpendWise backend API,
 * preventing accidental credential leakage to third-party endpoints.
 */
export function isApiUrl(url, baseURL = getApiBaseUrl()) {
  if (!url) {
    return true;
  }

  // Explicitly reject protocol-relative URLs (e.g., '//evil.example.com/api')
  if (typeof url === 'string' && url.startsWith('//')) {
    return false;
  }

  // Relative paths (e.g., '/auth/me', 'expenses') route to the API baseURL
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }

  try {
    const targetOrigin = new URL(url).origin;
    const baseOrigin = new URL(baseURL || getApiBaseUrl()).origin;
    return targetOrigin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * Standardized API Error class preserving HTTP status, backend error code,
 * human-readable message, and diagnostic details.
 */
export class ApiError extends Error {
  constructor(message, { status = null, code = 'UNKNOWN_ERROR', details = null, originalError = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.originalError = originalError;
    this.isNetworkError = !status && (code === 'NETWORK_ERROR' || code === 'ERR_NETWORK');
    this.isTimeout =
      code === 'TIMEOUT_ERROR' ||
      code === 'ECONNABORTED' ||
      (typeof message === 'string' && message.toLowerCase().includes('timeout'));
  }
}

/**
 * Creates and configures the core Axios client.
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request Interceptor: Ensure state-changing requests always carry the CSRF custom header,
// and attach Bearer token when running in token auth mode.
apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (stateChangingMethods.includes(method)) {
    config.headers = config.headers || {};
    if (!config.headers['X-Requested-With'] && !config.headers['x-requested-with']) {
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
    }
  }

  // Token mode: attach Authorization: Bearer <token> if available and target is the SpendWise API
  if (isTokenAuthMode() && isApiUrl(config.url, config.baseURL)) {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers['Authorization'] && !config.headers['authorization']) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  return config;
});

// Response & Error Handling Interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Return server response body (envelope) directly
    return response.data;
  },
  (error) => {
    // 1. The server responded with an HTTP status code outside 2xx
    if (error.response) {
      const status = error.response.status;
      const body = error.response.data;
      const message =
        body?.error?.message ||
        (typeof body?.message === 'string' ? body.message : error.message) ||
        'Request failed';
      const code =
        body?.error?.code ||
        (status === 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`);

      // Clear stored token only on genuine authentication failure (HTTP 401 or account deactivated),
      // preserving it across server errors (500), rate limiting (429), not found (404), validation (400), etc.
      if (isTokenAuthMode() && (status === 401 || (status === 403 && code === 'ACCOUNT_DEACTIVATED'))) {
        clearStoredToken();
      }

      return Promise.reject(
        new ApiError(message, {
          status,
          code,
          details: body,
          originalError: error
        })
      );
    }

    // 2. Request was made but no response was received (network offline or timed out)
    if (error.request) {
      const isTimeout =
        error.code === 'ECONNABORTED' ||
        (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'));

      const message = isTimeout
        ? 'Request timed out. Please check your connection and try again.'
        : 'Network error. Unable to connect to SpendWise server.';

      const code = isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR';

      return Promise.reject(
        new ApiError(message, {
          status: null,
          code,
          details: null,
          originalError: error
        })
      );
    }

    // 3. Something happened in setting up the request
    return Promise.reject(
      new ApiError(error.message || 'An unexpected error occurred', {
        status: null,
        code: 'CLIENT_SETUP_ERROR',
        details: null,
        originalError: error
      })
    );
  }
);

export default apiClient;
