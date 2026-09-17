import { Router } from "express";
import { analyticsWriteLimiter } from "../shared/middleware/rateLimit";
import {
  createAnalyticsEvent,
  getAnalyticsSummary,
  listAnalyticsEvents,
} from "./analytics.controller";

const analyticsRouter = Router();

analyticsRouter.get("/", getAnalyticsSummary);
analyticsRouter.get("/summary", getAnalyticsSummary);
analyticsRouter.get("/events", listAnalyticsEvents);
// Write/ingest endpoint gets a stricter per-IP limit than the rest of the API.
analyticsRouter.post("/events", analyticsWriteLimiter, createAnalyticsEvent);

export { analyticsRouter };
