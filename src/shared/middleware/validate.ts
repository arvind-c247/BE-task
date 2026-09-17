import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";

/**
 * Validates the request (body/query/params) and forwards any error to the
 * global error handler in shared/utils/errorHandler.ts, which formats
 * ZodError into a consistent 400 JSON response.
 */
export const validate = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      next(err);
    }
  };
};