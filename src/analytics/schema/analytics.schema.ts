import { z } from "zod";

export const analyticsEventSchema = z.object({
  type: z.string().trim().min(1),
  page: z.string().trim().min(1),
  visitorId: z.string().trim().min(1),
  metadata: z.record(z.string(), z.any()).default({}),
});

export const analyticsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  type: z.string().trim().min(1).optional(),
});
