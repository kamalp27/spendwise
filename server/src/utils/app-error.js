/**
 * Custom Operational Application Error
 * Encapsulates HTTP status codes and machine-readable error codes.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }

  static notFound(message, code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static unauthorized(message, code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message, code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
}
