import { z } from "zod";

export const fileDownloadParamsSchema = z.object({
  filename: z.string().trim().min(1),
});

export const fileDownloadRequestSchema = z.object({
  params: fileDownloadParamsSchema,
});