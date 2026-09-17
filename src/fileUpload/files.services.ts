import { randomUUID } from "crypto";
import path from "path";
import type { UploadedFile } from "express-fileupload";
import { ApiError } from "../shared/utils/ApiError";
import { fileRepository, createFileRepository } from "./files.repository";
import { FILE_UPLOAD_MAX_BYTES, FILE_UPLOAD_MAX_MB } from "../config/fileUpload";

export interface StoredFileMetadata {
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface DownloadedFile {
  name: string;
  data: Buffer;
  mimeType: string;
  size: number;
}

const normalizeStoredName = (originalName: string): string =>
  path.basename(originalName).replace(/[^A-Za-z0-9._-]/g, "_");

const validateFile = (file: UploadedFile) => {
  if (!file || file.size === undefined) {
    throw ApiError.badRequest("Invalid file payload");
  }
  if (file.size === 0) {
    throw ApiError.badRequest("Cannot upload an empty file");
  }
  if (file.size > FILE_UPLOAD_MAX_BYTES) {
    throw new ApiError(
      413,
      `File exceeds the ${FILE_UPLOAD_MAX_MB}MB upload limit`,
      "PAYLOAD_TOO_LARGE",
    );
  }
};

export const createFileService = (repository = createFileRepository()) => {
  /** Dedupes the stored name by appending a short id when it already exists. */
  const uniqueName = async (name: string): Promise<string> => {
    const safeName = normalizeStoredName(name) || `file-${randomUUID().slice(0, 8)}`;
    let candidate = safeName;

    if (await repository.exists(candidate)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      candidate = `${base}-${randomUUID().slice(0, 8)}${ext}`;
    }

    return candidate;
  };

  return {
  async upload(file: UploadedFile | UploadedFile[]): Promise<StoredFileMetadata[]> {
    await repository.ensureDir();

    const files = Array.isArray(file) ? file : [file];
    const stored: StoredFileMetadata[] = [];

    for (const entry of files) {
      validateFile(entry);
      const name = await uniqueName(entry.name ?? "file");

      await repository.write(name, entry.data);

      stored.push({
        name,
        size: entry.size,
        mimeType: (entry.mimetype as string) ?? "application/octet-stream",
        url: `/api/v1/file/download/${encodeURIComponent(name)}`,
      });
    }

    return stored;
  },

  async download(filename: string): Promise<DownloadedFile | null> {
    const data = await repository.read(path.basename(filename));
    if (!data) return null;

    return {
      name: path.basename(filename),
      data,
      mimeType: "application/octet-stream",
      size: data.length,
    };
  },
  };
};

export const fileService = createFileService(fileRepository);