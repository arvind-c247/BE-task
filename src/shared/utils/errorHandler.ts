import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "./ApiError";

/**
 * Register after every route. Catches requests that fell through the router
 * and answers with a consistent JSON 404 instead of the HTML default.
 */
export const notFoundHandler = (_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Route not found",
  });
};

/**
 * Global error handler. Must be the LAST middleware and keep the 4-arg
 * signature so Express treats it as an error handler.
 *
 * Express 5 automatically forwards rejected promises from async controllers
 * and any thrown error, so controllers/services only need to throw ApiError
 * (or let ZodError / any error propagate).
 *
 * Response shape: { error, message, details? }
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Invalid request payload";
    details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof Error) {
    // Never leak internals in production; log them server-side only.
    if (process.env.NODE_ENV !== "production") {
      message = err.message;
    }
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== "test") {
    console.error("[errorHandler]", err);
  }

  res.status(statusCode).json({
    error: code,
    message,
    ...(details !== undefined ? { details } : {}),
  });
};