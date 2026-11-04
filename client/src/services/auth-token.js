/**
 * SpendWise Authentication Token & Mode Manager
 *
 * Supports dual-origin authentication:
 * - Cookie mode (default, for Vercel & local development):
 *   Relies entirely on HTTP-only session cookies with withCredentials.
 *   Never reads, writes, or attaches Bearer tokens.
 * - Token mode (for GitHub Pages):
 *   Enabled explicitly when VITE_AUTH_MODE === 'token'.
 *   Stores session credential in sessionStorage under 'spendwise_auth_token'.
 *   Attaches 'Authorization: Bearer <token>' to API requests.
 */

export const AUTH_TOKEN_KEY = 'spendwise_auth_token';

let authModeTestOverride = null;

/**
 * Resolves the active authentication mode.
 * Defaults to 'cookie' unless VITE_AUTH_MODE is explicitly set to 'token'.
 *
 * @returns {'cookie' | 'token'}
 */
export function getAuthMode() {
  if (authModeTestOverride !== null) {
    return authModeTestOverride === 'token' ? 'token' : 'cookie';
  }

  const mode =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_AUTH_MODE
      : undefined;

  return mode === 'token' ? 'token' : 'cookie';
}

/**
 * Returns true if the client is operating in Bearer token authentication mode.
 *
 * @returns {boolean}
 */
export function isTokenAuthMode() {
  return getAuthMode() === 'token';
}

/**
 * Safely retrieves the stored authentication token from sessionStorage.
 * In cookie mode, always returns null without touching sessionStorage.
 *
 * @returns {string | null}
 */
export function getStoredToken() {
  if (!isTokenAuthMode()) {
    return null;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const token = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
      return typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
    }
  } catch {
    // Gracefully handle storage access restrictions
  }

  return null;
}

/**
 * Safely stores the authentication token in sessionStorage.
 * In cookie mode, does nothing without touching sessionStorage.
 *
 * @param {string} token
 */
export function setStoredToken(token) {
  if (!isTokenAuthMode()) {
    return;
  }

  if (!token || typeof token !== 'string') {
    return;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token.trim());
    }
  } catch {
    // Gracefully handle quota or storage access errors
  }
}

/**
 * Safely clears the stored authentication token from sessionStorage.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false] Force removal even if not in token mode (for test cleanup)
 */
export function clearStoredToken({ force = false } = {}) {
  if (!force && !isTokenAuthMode()) {
    return;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Gracefully handle storage access restrictions
  }
}

/**
 * Overrides the auth mode for unit tests.
 *
 * @param {'cookie' | 'token' | null} mode
 */
export function setAuthModeForTesting(mode) {
  authModeTestOverride = mode;
}

/**
 * Resets the auth mode override after testing.
 */
export function resetAuthModeForTesting() {
  authModeTestOverride = null;
}
