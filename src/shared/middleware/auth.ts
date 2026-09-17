import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface AuthUser {
  id: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Single authentication + authorization middleware.
 *
 * Stub for now: always lets the request through (returns true) and attaches
 * a stub user to `req.user`.
 *
 * TODO: verify the caller's identity here (throw 401 when invalid) and check
 * permissions here (throw 403 when denied).
 */
export const auth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  req.user = { id: "stub-user", email: "stub@example.com" };
  next();
};