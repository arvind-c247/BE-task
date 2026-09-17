/**
 * Structured error used across the API. Controllers/services only need to
 * `throw` an ApiError (or let a ZodError / any error propagate) — the global
 * error handler in ./errorHandler.ts formats it into a consistent JSON
 * response.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message = "Conflict"): ApiError {
    return new ApiError(409, message, "CONFLICT");
  }

  static validation(message = "Validation failed", details?: unknown): ApiError {
    return new ApiError(400, message, "VALIDATION_ERROR", details);
  }

  static rateLimited(message = "Too many requests, please try again later."): ApiError {
    return new ApiError(429, message, "RATE_LIMITED");
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;