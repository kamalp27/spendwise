import apiClient from './api-client.js';

export {
  AUTH_TOKEN_KEY,
  getAuthMode,
  isTokenAuthMode,
  getStoredToken,
  setStoredToken,
  clearStoredToken
} from './auth-token.js';

/**
 * Authentication Service
 * Communicates with backend session authentication endpoints.
 * All operations rely on secure, HTTP-only cookies managed by the browser.
 */
export const AuthService = {
  /**
   * Retrieves the profile of the current authenticated user session.
   * Calls GET /api/v1/auth/me.
   *
   * @returns {Promise<Object>} Safe user profile { id, email, displayName, currency, createdAt, lastLoginAt }
   */
  async getProfile() {
    const res = await apiClient.get('/auth/me');
    return res?.data || null;
  },

  /**
   * Authenticates user credentials and establishes a new server session.
   * Calls POST /api/v1/auth/login.
   *
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} Authenticated user profile
   */
  async login(credentials) {
    const res = await apiClient.post('/auth/login', credentials);
    return res?.data || null;
  },

  /**
   * Registers a new account and immediately establishes a server session.
   * Calls POST /api/v1/auth/register.
   *
   * @param {Object} data - { email, password, displayName, currency }
   * @returns {Promise<Object>} Newly created user profile
   */
  async register(data) {
    const res = await apiClient.post('/auth/register', data);
    return res?.data || null;
  },

  /**
   * Revokes the active session in PostgreSQL and clears the session cookie.
   * Calls POST /api/v1/auth/logout.
   *
   * @returns {Promise<Object>} Success message { message: 'Logged out successfully.' }
   */
  async logout() {
    const res = await apiClient.post('/auth/logout');
    return res?.data || res;
  }
};

export default AuthService;
