import fs from "fs/promises";
import path from "path";
import { FILES_DIR } from "../config/fileUpload";

/** Files live on disk under public/files; no DB involved. */
const safeStoredName = (name: string): string => path.basename(name);

export const createFileRepository = (storageDir: string = FILES_DIR) => ({
  getStorageDir(): string {
    return storageDir;
  },

  async ensureDir(): Promise<void> {
    await fs.mkdir(storageDir, { recursive: true });
  },

  async exists(name: string): Promise<boolean> {
    return fs
      .access(path.join(storageDir, safeStoredName(name)))
      .then(() => true)
      .catch(() => false);
  },

  async write(name: string, data: Buffer): Promise<void> {
    await fs.writeFile(path.join(storageDir, safeStoredName(name)), data);
  },

  /** Reads the file back, resolving to null when it doesn't exist. */
  async read(name: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(storageDir, safeStoredName(name)));
    } catch {
      return null;
    }
  },
});

export const fileRepository = createFileRepository();