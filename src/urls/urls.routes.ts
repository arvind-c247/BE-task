import { Router } from "express";
import { validate } from "../shared/middleware/validate";
import { urlsWriteLimiter } from "../shared/middleware/rateLimit";
import {
  shortenRequestSchema,
  urlCodeRequestSchema,
  urlListRequestSchema,
} from "./schema/urls.schema";
import {
  getUrlAnalytics,
  getUrlStatsSummary,
  listUrls,
  redirectToOriginalUrl,
  shortenUrl,
} from "./urls.controller";

// Mounted under /api/v1 (see ../routes/routes.ts).
export const urlsRouter = Router();

urlsRouter.post("/shorten", urlsWriteLimiter, validate(shortenRequestSchema), shortenUrl);
urlsRouter.get("/analytics/:code", validate(urlCodeRequestSchema), getUrlAnalytics);
urlsRouter.get("/urls", validate(urlListRequestSchema), listUrls);
// Keep /urls/stats before /urls/:code so "stats" is not captured as a code.
urlsRouter.get("/urls/stats", getUrlStatsSummary);

// Mounted at the app root so GET /:code redirects outside the /api/v1 prefix
// (see ../index.ts).
export const redirectRouter = Router();

redirectRouter.get("/:code", redirectToOriginalUrl);