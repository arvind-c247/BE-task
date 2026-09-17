import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type AnalyticsEventType =
  | "page_view"
  | "click"
  | "signup"
  | "purchase"
  | "custom";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType | string;
  page: string;
  visitorId: string;
  metadata: Record<string, unknown>;
  createdAt: string | Date;
}

const seedEvents = (): AnalyticsEvent[] => [
  {
    id: randomUUID(),
    type: "page_view",
    page: "/home",
    visitorId: "guest-1",
    metadata: { browser: "chrome" },
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    type: "page_view",
    page: "/pricing",
    visitorId: "guest-2",
    metadata: { browser: "firefox" },
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    type: "signup",
    page: "/signup",
    visitorId: "guest-1",
    metadata: { source: "organic" },
    createdAt: new Date().toISOString(),
  },
];

const normalizeEvent = (event: AnalyticsEvent) => ({
  ...event,
  createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
  metadata: event.metadata ?? {},
});

/**
 * In-memory fallback store used when the database is unavailable.
 * State lives on the instance (not at module scope, i.e. no "static"
 * module-level array), so each repository or test can own an isolated copy.
 */
export class InMemoryAnalyticsStore {
  private events: AnalyticsEvent[] = seedEvents();

  getSummary() {
    const totalEvents = this.events.length;
    const totalPageViews = this.events.filter((event) => event.type === "page_view").length;
    const uniqueVisitors = new Set(this.events.map((event) => event.visitorId)).size;

    return {
      totalVisitors: uniqueVisitors,
      totalPageViews,
      totalEvents,
      generatedAt: new Date().toISOString(),
    };
  }

  list({ limit = 20, type }: { limit?: number; type?: string } = {}) {
    let filtered = [...this.events];

    if (type) {
      filtered = filtered.filter((event) => event.type === type);
    }

    return filtered
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((event) => normalizeEvent(event));
  }

  create(input: Omit<AnalyticsEvent, "id" | "createdAt">) {
    const event: AnalyticsEvent = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return normalizeEvent(event);
  }

  /** Resets the store to its seeded state (useful in tests). */
  clear() {
    this.events = seedEvents();
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
 * Pass your own store (e.g. a fresh one per test) when you need isolated state
 * instead of the shared module-level singleton.
 */
export const createAnalyticsRepository = (
  memoryStore: InMemoryAnalyticsStore = new InMemoryAnalyticsStore(),
) => ({
  async getSummary() {
    if (!(await canUseDatabase())) {
      return memoryStore.getSummary();
    }

    try {
      const [totalEvents, totalPageViews, visitorGroups] = await Promise.all([
        prisma.analyticsEvent.count(),
        prisma.analyticsEvent.count({ where: { type: "page_view" } }),
        prisma.analyticsEvent.groupBy({ by: ["visitorId"] }),
      ]);

      return {
        totalVisitors: visitorGroups.length,
        totalPageViews,
        totalEvents,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return memoryStore.getSummary();
    }
  },

  async listEvents({ limit = 20, type }: { limit?: number; type?: string } = {}) {
    if (!(await canUseDatabase())) {
      return memoryStore.list({ limit, type });
    }

    try {
      const events = await prisma.analyticsEvent.findMany({
        where: type ? { type } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return events.map((event) => ({
        ...event,
        metadata: (event.metadata as Record<string, unknown>) ?? {},
        createdAt: event.createdAt.toISOString(),
      }));
    } catch {
      return memoryStore.list({ limit, type });
    }
  },

  async createEvent(input: Omit<AnalyticsEvent, "id" | "createdAt">) {
    if (!(await canUseDatabase())) {
      return memoryStore.create(input);
    }

    try {
      const event = await prisma.analyticsEvent.create({
        data: {
          ...input,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      return {
        ...event,
        metadata: (event.metadata as Record<string, unknown>) ?? {},
        createdAt: event.createdAt.toISOString(),
      };
    } catch {
      return memoryStore.create(input);
    }
  },
});

// Default singleton — kept for backward compatibility with routes/controller/tests.
// Use createAnalyticsRepository() when you need per-instance state.
export const analyticsRepository = createAnalyticsRepository();
