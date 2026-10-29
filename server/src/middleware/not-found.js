/**
 * 404 Not Found Middleware
 * Invoked when no preceding route matches the incoming request.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND'
    }
  });
}
