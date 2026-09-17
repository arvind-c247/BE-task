import { analyticsRepository, createAnalyticsRepository } from "./analytics.repository";
import { analyticsEventSchema } from "./schema/analytics.schema";

/**
 * Factory that builds a service around its own repository (and therefore its
 * own in-memory fallback store). Useful for tests that need isolated state.
 */
export const createAnalyticsService = (repository = createAnalyticsRepository()) => ({
  async getSummary() {
    return repository.getSummary();
  },

  async listEvents({ limit, type }: { limit?: number; type?: string } = {}) {
    return repository.listEvents({ limit, type });
  },

  async createEvent(input: unknown) {
    const parsed = analyticsEventSchema.parse(input);
    return repository.createEvent({
      ...parsed,
      metadata: parsed.metadata ?? {},
    });
  },
});

// Default singleton sharing the default repository's store — matches the
// previous module-level behavior exactly.
export const analyticsService = createAnalyticsService(analyticsRepository);
