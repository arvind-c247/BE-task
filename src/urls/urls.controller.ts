import type { Request, Response } from "express";
import { ApiError } from "../shared/utils/ApiError";
import { urlService } from "./urls.services";

export const shortenUrl = async (req: Request, res: Response) => {
  const record = await urlService.shorten(req.body);

  res.status(201).json({
    shortCode: record.shortCode,
    originalUrl: record.originalUrl,
    clickCount: record.clickCount,
    createdAt: record.createdAt,
  });
};

export const redirectToOriginalUrl = async (req: Request, res: Response) => {
  const code = String(req.params.code);
  const record = await urlService.resolveAndTrack(code);

  if (!record) {
    throw ApiError.notFound("Short link not found");
  }

  res.redirect(302, record.originalUrl);
};

export const getUrlAnalytics = async (req: Request, res: Response) => {
  const code = String(req.params.code);
  const record = await urlService.findByCode(code);

  if (!record) {
    throw ApiError.notFound("Short link not found");
  }

  res.status(200).json({
    shortCode: record.shortCode,
    originalUrl: record.originalUrl,
    clickCount: record.clickCount,
    createdAt: record.createdAt,
  });
};

export const listUrls = async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 20);
  const urls = await urlService.list({ limit });

  res.status(200).json({
    count: urls.length,
    urls,
  });
};

export const getUrlStatsSummary = async (_req: Request, res: Response) => {
  const summary = await urlService.getSummary();

  res.status(200).json(summary);
};