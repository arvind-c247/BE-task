import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface UrlRecord {
  id: string;
  originalUrl: string;
  shortCode: string;
  clickCount: number;
  createdAt: string | Date;
}

/** Thrown when a short code is already taken (DB unique violation or in-memory hit). */
export class UrlConflictError extends Error {
  constructor(shortCode: string) {
    super(`Short code already exists: ${shortCode}`);
    this.name = "UrlConflictError";
  }
}

const normalizeUrl = (record: UrlRecord) => ({
  ...record,
  createdAt:
    record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : record.createdAt,
});

/**
 * In-memory fallback store used when the database is unavailable. State lives
 * on the instance so each repository or test can own an isolated copy.
 */
export class InMemoryUrlStore {
  private urls: UrlRecord[] = [];

  create(input: { originalUrl: string; shortCode: string }): UrlRecord {
    if (this.urls.some((url) => url.shortCode === input.shortCode)) {
      throw new UrlConflictError(input.shortCode);
    }

    const url: UrlRecord = {
      ...input,
      id: randomUUID(),
      clickCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.urls.push(url);
    return url;
  }

  findByCode(shortCode: string): UrlRecord | undefined {
    return this.urls.find((url) => url.shortCode === shortCode);
  }

  incrementClick(shortCode: string): UrlRecord | undefined {
    const url = this.urls.find((entry) => entry.shortCode === shortCode);
    if (url) url.clickCount += 1;
    return url;
  }

  list({ limit = 20 }: { limit?: number } = {}) {
    return [...this.urls]
      .map((record, index) => ({ record, index }))
      .sort(
        (a, b) =>
          new Date(b.record.createdAt).getTime() -
            new Date(a.record.createdAt).getTime() ||
          // Seconds-resolution ties (or records created in the same millisecond)
          // fall back to insertion order so the sort stays stable.
          a.index - b.index,
      )
      .slice(0, limit)
      .map(({ record }) => normalizeUrl(record));
  }

  getSummary() {
    const totalLinks = this.urls.length;
    const totalClicks = this.urls.reduce((sum, url) => sum + url.clickCount, 0);
    const mostClicked = [...this.urls].sort(
      (a, b) => b.clickCount - a.clickCount || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0];

    return {
      totalLinks,
      totalClicks,
      avgClicksPerLink: totalLinks ? Math.round(totalClicks / totalLinks) : 0,
      mostClicked: mostClicked ? normalizeUrl(mostClicked) : null,
    };
  }

  /** Resets the store to its empty state (useful in tests). */
  clear() {
    this.urls = [];
  }
}

const canUseDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

/**
 * Factory that creates a repository bound to its own in-memory fallback store.
 * Pass your own store (e.g. a fresh one per test) for isolated state.
 */
export const createUrlRepository = (
  memoryStore: InMemoryUrlStore = new InMemoryUrlStore(),
) => ({
  async create(input: { originalUrl: string; shortCode: string }) {
    if (!(await canUseDatabase())) {
      return memoryStore.create(input);
    }

    try {
      const record = await prisma.url.create({ data: input });
      return normalizeUrl(record);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new UrlConflictError(input.shortCode);
      }
      throw err;
    }
  },

  async findByCode(shortCode: string) {
    if (!(await canUseDatabase())) {
      const record = memoryStore.findByCode(shortCode);
      return record ? normalizeUrl(record) : null;
    }

    try {
      const record = await prisma.url.findUnique({ where: { shortCode } });
      return record ? normalizeUrl(record) : null;
    } catch {
      const record = memoryStore.findByCode(shortCode);
      return record ? normalizeUrl(record) : null;
    }
  },

  async incrementClick(shortCode: string) {
    if (!(await canUseDatabase())) {
      const record = memoryStore.incrementClick(shortCode);
      return record ? normalizeUrl(record) : null;
    }

    try {
      const record = await prisma.url.update({
        where: { shortCode },
        data: { clickCount: { increment: 1 } },
      });
      return normalizeUrl(record);
    } catch {
      const record = memoryStore.incrementClick(shortCode);
      return record ? normalizeUrl(record) : null;
    }
  },

  async list({ limit = 20 }: { limit?: number } = {}) {
    if (!(await canUseDatabase())) {
      return memoryStore.list({ limit });
    }

    try {
      const records = await prisma.url.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return records.map((record) => normalizeUrl(record));
    } catch {
      return memoryStore.list({ limit });
    }
  },

  async getSummary() {
    if (!(await canUseDatabase())) {
      return memoryStore.getSummary();
    }

    try {
      const [totalLinks, clickAggregate, mostClicked] = await Promise.all([
        prisma.url.count(),
        prisma.url.aggregate({ _sum: { clickCount: true } }),
        prisma.url.findFirst({
          orderBy: [{ clickCount: "desc" }, { createdAt: "asc" }],
        }),
      ]);

      const totalClicks = clickAggregate._sum.clickCount ?? 0;

      return {
        totalLinks,
        totalClicks,
        avgClicksPerLink: totalLinks ? Math.round(totalClicks / totalLinks) : 0,
        mostClicked: mostClicked ? normalizeUrl(mostClicked) : null,
      };
    } catch {
      return memoryStore.getSummary();
    }
  },
});

// Default singleton sharing the default store. Use createUrlRepository() when
// you need per-instance state.
export const urlRepository = createUrlRepository();