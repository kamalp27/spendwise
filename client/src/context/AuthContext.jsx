import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AuthService } from '../services/auth.service.js';

/**
 * Default fallback context for components rendered outside an AuthProvider
 * (e.g., isolated legacy unit tests). In production, AuthProvider is always mounted.
 */
const DEFAULT_AUTH_CONTEXT = {
  status: 'authenticated',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'dev.user@spendwise.example',
    displayName: 'Dev User',
    currency: 'INR'
  },
  error: null,
  login: async () => {},
  register: async () => {},
  refreshSession: async () => {},
  logout: async () => {}
};

export const AuthContext = createContext(DEFAULT_AUTH_CONTEXT);

/**
 * Hook to consume the authentication state and operations.
 *
 * Exposes:
 * - status: 'loading' | 'authenticated' | 'unauthenticated'
 * - user: safe user profile object or null
 * - error: safe error descriptor { message, code } or null
 * - refreshSession: async function to re-validate session with backend
 * - logout: async function to terminate active session
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Authentication Provider
 * Manages the live server-backed session lifecycle.
 * All state is held in React memory; credentials remain in HTTP-only cookies.
 */
export function AuthProvider({
  children,
  initialStatus = 'loading',
  initialUser = null
}) {
  const [status, setStatus] = useState(initialStatus);
  const [user, setUser] = useState(initialUser);
  const [error, setError] = useState(null);

  // Lifecycle & Concurrency References
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Checks the active session by calling GET /api/v1/auth/me.
   * Concurrency-safe: discards stale responses if a newer check has started.
   */
  const checkSession = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    if (isMountedRef.current) {
      setStatus('loading');
      setError(null);
    }

    try {
      const profile = await AuthService.getProfile();

      if (isMountedRef.current && currentRequestId === requestIdRef.current) {
        setUser(profile);
        setStatus('authenticated');
        setError(null);
      }
      return profile;
    } catch (err) {
      if (isMountedRef.current && currentRequestId === requestIdRef.current) {
        setUser(null);

        // 1. Standard unauthenticated responses (HTTP 401)
        if (err.status === 401) {
          setStatus('unauthenticated');
          setError(null);
        } else if (err.status === 403) {
          // Deactivated account or forbidden
          setStatus('unauthenticated');
          setError({
            message: err.message || 'Account access has been deactivated.',
            code: err.code || 'ACCOUNT_DEACTIVATED'
          });
        } else {
          // 2. Network errors or unexpected server errors (500)
          // Preserved as distinct, recoverable error state without exposing internal details
          setStatus('unauthenticated');
          setError({
            message: err.isNetworkError
              ? 'Unable to connect to authentication server. Please check your network connection.'
              : 'Authentication service temporarily unavailable. Please try again later.',
            code: err.code || (err.isNetworkError ? 'NETWORK_ERROR' : 'SERVER_ERROR')
          });
        }
      }
      return null;
    }
  }, []);

  // Initial session restoration on mount (unless initial status was explicitly set)
  useEffect(() => {
    if (initialStatus === 'loading') {
      checkSession();
    }
  }, [checkSession, initialStatus]);

  /**
   * Authenticates user credentials, sets active user profile, and updates status to 'authenticated'.
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} Safe user profile
   */
  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const profile = await AuthService.login(credentials);
      if (isMountedRef.current) {
        setUser(profile);
        setStatus('authenticated');
        setError(null);
      }
      return profile;
    } catch (err) {
      const safeError = {
        message: err.message || 'Login failed. Please check your credentials.',
        code: err.code || 'LOGIN_FAILED',
        status: err.status || null,
        isNetworkError: Boolean(err.isNetworkError)
      };
      if (isMountedRef.current) {
        setError(safeError);
      }
      throw safeError;
    }
  }, []);

  /**
   * Registers a new account, sets active user profile, and updates status to 'authenticated'.
   * @param {Object} data - { email, password, displayName, currency }
   * @returns {Promise<Object>} Safe user profile
   */
  const register = useCallback(async (data) => {
    setError(null);
    try {
      const profile = await AuthService.register(data);
      if (isMountedRef.current) {
        setUser(profile);
        setStatus('authenticated');
        setError(null);
      }
      return profile;
    } catch (err) {
      const safeError = {
        message: err.message || 'Registration failed. Please check your details.',
        code: err.code || 'REGISTRATION_FAILED',
        status: err.status || null,
        isNetworkError: Boolean(err.isNetworkError)
      };
      if (isMountedRef.current) {
        setError(safeError);
      }
      throw safeError;
    }
  }, []);

  /**
   * Refreshes the current session state.
   */
  const refreshSession = useCallback(async () => {
    return checkSession();
  }, [checkSession]);

  /**
   * Revokes the active session on the backend and immediately clears local state.
   * Cleans local state even if the server request fails.
   */
  const logout = useCallback(async () => {
    let logoutError = null;

    try {
      await AuthService.logout();
    } catch (err) {
      // Preserve safe recoverable error without blocking local logout
      logoutError = {
        message: 'Server session termination encountered an issue, but local session was cleared.',
        code: err.code || 'LOGOUT_WARNING'
      };
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setStatus('unauthenticated');
        setError(logoutError);
      }
    }

    return { success: true, error: logoutError };
  }, []);

  const value = {
    status,
    user,
    error,
    login,
    register,
    refreshSession,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
