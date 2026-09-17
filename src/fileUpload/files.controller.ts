import type { Request, Response } from "express";
import { ApiError } from "../shared/utils/ApiError";
import { fileService } from "./files.services";

export const uploadFile = async (req: Request, res: Response) => {
  const file = req.files?.file;

  if (!file) {
    throw ApiError.badRequest("No file uploaded — use a multipart field named 'file'");
  }

  const files = await fileService.upload(file);

  res.status(201).json({
    message: "File(s) uploaded successfully",
    files,
  });
};

export const downloadFile = async (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  const file = await fileService.download(filename);

  if (!file) {
    throw ApiError.notFound("File not found");
  }

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Length", String(file.size));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.name)}"`,
  );
  res.send(file.data);
};