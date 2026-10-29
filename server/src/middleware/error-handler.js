/**
 * Centralized Error Handling Middleware
 * Ensures uniform error envelopes and prevents leaking internal details or stack traces in production.
 */
export function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Malformed JSON in request body',
        code: 'BAD_REQUEST'
      }
    });
  }

  // Handle CORS unauthorized origin errors
  if (err.message && err.message.includes('CORS origin')) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Origin not allowed by CORS policy',
        code: 'FORBIDDEN'
      }
    });
  }

  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599
    ? err.statusCode
    : typeof err.status === 'number' && err.status >= 400 && err.status <= 599
      ? err.status
      : 500;

  // Safe message in production for 500s
  const message = isProduction && statusCode === 500
    ? 'Internal server error'
    : err.message || 'An unexpected error occurred';

  const response = {
    success: false,
    error: {
      message,
      code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR')
    }
  };

  // Only include stack trace in development/debugging, never in production or test when testing production mode
  if (!isProduction && process.env.NODE_ENV !== 'test' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
