import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF Protection Middleware for State-Changing Requests
 * Defense-in-depth:
 * 1. Checks that non-safe HTTP methods provide custom header (X-Requested-With or X-SpendWise-CSRF),
 *    which browsers refuse to send cross-origin without prior CORS preflight authorization.
 * 2. Checks Origin header if provided to ensure it matches the configured trusted CLIENT_URL.
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 1. Validate custom header
  const customHeader = req.headers['x-requested-with'] || req.headers['x-spendwise-csrf'];
  if (!customHeader) {
    return next(
      AppError.forbidden(
        'CSRF validation failed: Missing required X-Requested-With header.',
        'CSRF_VALIDATION_FAILED'
      )
    );
  }

  // 2. Validate Origin header if present
  if (req.headers.origin) {
    const requestOrigin = req.headers.origin.replace(/\/+$/, '');
    if (requestOrigin !== env.CLIENT_URL) {
      return next(
        AppError.forbidden(
          `CSRF validation failed: Untrusted request origin "${req.headers.origin}".`,
          'CSRF_ORIGIN_MISMATCH'
        )
      );
    }
  }

  next();
}
