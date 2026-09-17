import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

/**
 * Custom 429 body so rate-limit errors match the API's JSON error shape
 * (see ./validate.ts and analytics.controller.ts, which use the same
 * `{ error, message }` format).
 */
const rateLimitExceededHandler = (_req: Request, res: Response, _next: NextFunction) => {
  res.status(429).json({
    error: "RATE_LIMITED",
    message: "Too many requests, please try again later.",
  });
};

/**
 * Resolved rate-limit configuration. Reads `process.env` directly (no dotenv
 * import) so that Jest tests that mount these routers do not trigger
 * .env/Prisma loading; in the app, dotenv has already run in config/env.ts
 * before this module loads.
 */
export const rateLimitConfig = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  apiMax: Number(process.env.RATE_LIMIT_MAX) || 10,
  createMax: Number(process.env.RATE_LIMIT_CREATE_MAX) || 10,
};

const makeRateLimiter = (limit: number) =>
  rateLimit({
    windowMs: rateLimitConfig.windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
  });

/**
 * General API-wide limiter applied to every route under /api/v1.
 * Default: 10 requests / minute per IP (override via RATE_LIMIT_MAX).
 */
export const apiRateLimiter = makeRateLimiter(rateLimitConfig.apiMax);

/**
 * Stricter limiter for write/ingest endpoints such as event tracking.
 * Default: 10 requests / minute per IP (override via RATE_LIMIT_CREATE_MAX).
 */
export const analyticsWriteLimiter = makeRateLimiter(rateLimitConfig.createMax);

/**
 * Write limiter for URL creation (POST /api/v1/shorten). Same budget as the
 * analytics write limiter.
 */
export const urlsWriteLimiter = makeRateLimiter(rateLimitConfig.createMax);