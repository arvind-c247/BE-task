import type { Request, Response } from "express";
import { analyticsQuerySchema } from "./schema/analytics.schema";
import { analyticsService } from "./analytics.services";

export const getAnalyticsSummary = async (_req: Request, res: Response) => {
  const summary = await analyticsService.getSummary();
  res.status(200).json(summary);
};

export const listAnalyticsEvents = async (req: Request, res: Response) => {
  const parsedQuery = analyticsQuerySchema.safeParse(req.query);
  const query = parsedQuery.success ? parsedQuery.data : { limit: 20 };

  const events = await analyticsService.listEvents({
    limit: query.limit,
    type: query.type,
  });

  res.status(200).json({
    count: events.length,
    events,
  });
};

export const createAnalyticsEvent = async (req: Request, res: Response) => {
  // Validation failures (ZodError) are forwarded by Express 5 to the global
  // error handler in shared/utils/errorHandler.ts.
  const event = await analyticsService.createEvent(req.body);

  res.status(201).json({
    message: "Event tracked successfully",
    event,
  });
};
