import { randomBytes } from "crypto";
import { ApiError } from "../shared/utils/ApiError";
import { shortenUrlSchema } from "./schema/urls.schema";
import {
  createUrlRepository,
  UrlRecord,
  urlRepository,
  UrlConflictError,
} from "./urls.repository";

const SHORT_CODE_LENGTH = 6;
const SHORT_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_GENERATION_ATTEMPTS = 5;

export const generateShortCode = (length = SHORT_CODE_LENGTH): string => {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return code;
};

/**
 * Factory that builds a service around its own repository (and therefore its
 * own in-memory fallback store). Useful for tests that need isolated state.
 */
export const createUrlService = (repository = createUrlRepository()) => ({
  async shorten(input: unknown): Promise<UrlRecord> {
    const { url } = shortenUrlSchema.parse(input);

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const shortCode = generateShortCode();

      try {
        return await repository.create({ originalUrl: url, shortCode });
      } catch (err) {
        if (err instanceof UrlConflictError) continue;
        throw err;
      }
    }

    throw ApiError.internal("Could not generate a unique short code");
  },

  async findByCode(shortCode: string) {
    return repository.findByCode(shortCode);
  },

  /** Resolves a code, increments its click count, and returns the record. */
  async resolveAndTrack(shortCode: string) {
    return repository.incrementClick(shortCode);
  },

  async list({ limit = 20 }: { limit?: number } = {}) {
    return repository.list({ limit });
  },

  async getSummary() {
    return repository.getSummary();
  },
});

// Default singleton sharing the default repository's store.
export const urlService = createUrlService(urlRepository);