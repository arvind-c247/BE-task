import path from "path";

export const FILE_UPLOAD_MAX_MB = Number(process.env.FILE_UPLOAD_MAX_MB) || 10;

export const FILE_UPLOAD_MAX_BYTES = FILE_UPLOAD_MAX_MB * 1024 * 1024;

/** Files are stored under <project>/public/files and served from /files/*. */
export const FILES_DIR = path.join(process.cwd(), "public", "files");