import { z } from "zod";

const httpUrlSchema = z
  .string()
  .trim()
  .url("Invalid URL")
  .refine((value) => /^https?:\/\//i.test(value), "URL must use http or https");

export const shortenUrlSchema = z.object({
  url: httpUrlSchema,
});

export const urlCodeParamsSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

// Thrown inline by the global error handler as a 400 VALIDATION_ERROR.
export const shortenRequestSchema = z.object({
  body: shortenUrlSchema,
});

export const urlCodeRequestSchema = z.object({
  params: urlCodeParamsSchema,
});

export const urlListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const urlListRequestSchema = z.object({
  query: urlListQuerySchema,
});