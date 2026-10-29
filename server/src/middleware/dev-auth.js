import { DEV_USER } from '../db/seed.js';
import { AppError } from '../utils/app-error.js';

/**
 * Development & Test User Context Middleware
 *
 * SCOPE & SECURITY ENFORCEMENT:
 * - Development identity access is ALLOWED ONLY when process.env.NODE_ENV is explicitly
 *   "development" or "test".
 * - Any other environment (production, staging, preview, uat, unset, or empty) FAILS CLOSED,
 *   rejecting the request with HTTP 401 Unauthorized.
 * - Client-supplied headers (e.g. x-user-id) or query parameters are strictly IGNORED.
 */
export function devAuthMiddleware(req, res, next) {
  const currentEnv = process.env.NODE_ENV;
  const isAllowedDevEnv = currentEnv === 'development' || currentEnv === 'test';

  if (!isAllowedDevEnv) {
    return next(
      AppError.unauthorized(
        'Authentication has not been implemented for non-development environments. Access denied.',
        'AUTH_NOT_IMPLEMENTED'
      )
    );
  }

  // In development and test environments, bind request context strictly to DEV_USER
  req.user = Object.freeze({
    id: DEV_USER.id,
    email: DEV_USER.email,
    displayName: DEV_USER.displayName,
    currency: DEV_USER.currency
  });

  next();
}
