import express from "express";
import request from "supertest";
// Explicit imports so describe/expect/it resolve even when the editor's TS
// server doesn't auto-load the ambient @types/jest globals.
import { describe, expect, it } from "@jest/globals";
import { analyticsRouter } from "../analytics.routes";
import { InMemoryAnalyticsStore } from "../analytics.repository";
import { rateLimitConfig } from "../../shared/middleware/rateLimit";
import mainRouter from "../../routes/routes";

const app = express();
app.use(express.json());
app.use("/analytics", analyticsRouter);

// App mounted on the real router to exercise the global /api/v1 limiter.
const apiApp = express();
apiApp.use(express.json());
apiApp.use("/api/v1", mainRouter);

describe("analytics routes", () => {
  it("returns a summary payload", async () => {
    const res = await request(app).get("/analytics/summary");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalVisitors: expect.any(Number),
      totalPageViews: expect.any(Number),
      totalEvents: expect.any(Number),
    });
  });

  it("creates a new analytics event", async () => {
    const payload = {
      type: "page_view",
      page: "/dashboard",
      visitorId: "visitor-123",
      metadata: { browser: "chrome" },
    };

    const res = await request(app).post("/analytics/events").send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message: "Event tracked successfully",
      event: {
        type: "page_view",
        page: "/dashboard",
        visitorId: "visitor-123",
      },
    });
  });
describe("InMemoryAnalyticsStore", () => {
  it("isolates state between instances (no hidden module-level state)", () => {
    const storeA = new InMemoryAnalyticsStore();
    const storeB = new InMemoryAnalyticsStore();

    storeA.create({
      type: "click",
      page: "/cta",
      visitorId: "visitor-isolated",
      metadata: {},
    });

    expect(storeA.getSummary().totalEvents).toBe(4);
    expect(storeB.getSummary().totalEvents).toBe(3);
    expect(storeB.list({ limit: 10 })).toHaveLength(3);
  });

  it("resets to seeded state after clear()", () => {
    const store = new InMemoryAnalyticsStore();

    store.create({
      type: "signup",
      page: "/register",
      visitorId: "visitor-clear",
      metadata: {},
    });
    expect(store.getSummary().totalEvents).toBe(4);

    store.clear();
    expect(store.getSummary().totalEvents).toBe(3);
    expect(store.list({ limit: 10 })).toHaveLength(3);
  });
});
});
describe("rate limiting", () => {
  it("blocks event writes once the per-IP create limit is exceeded", async () => {
    // Earlier route tests already consumed 1 of the per-minute budget, so the
    // create limiter (analyticsWriteLimiter) is guaranteed to trigger within
    // the attempts fired below.
    const statuses: number[] = [];
    let blockedBody: unknown = null;
    let retryAfter: string | undefined;
    let rateLimitHeader: string | undefined;

    for (let i = 0; i < rateLimitConfig.createMax + 2; i += 1) {
      const res = await request(app)
        .post("/analytics/events")
        .send({ type: "click", page: "/cta", visitorId: "rate-limited", metadata: {} });

      statuses.push(res.status);

      if (res.status === 429) {
        blockedBody = res.body;
        retryAfter = res.headers["retry-after"] as string | undefined;
        // draft-7 format: "RateLimit: limit=10, remaining=0, reset=60"
        rateLimitHeader = res.headers["ratelimit"] as string | undefined;
        break;
      }
    }

    expect(blockedBody).not.toBeNull();
    expect(blockedBody).toMatchObject({ error: "RATE_LIMITED" });
    expect(retryAfter).toBeDefined();
    expect(rateLimitHeader).toMatch(
      new RegExp(`limit=${rateLimitConfig.createMax}`),
    );
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it(`enforces the global /api/v1 limiter (${rateLimitConfig.apiMax} req/min)`, async () => {
    const statuses: number[] = [];

    for (let i = 0; i < rateLimitConfig.apiMax + 1; i += 1) {
      const res = await request(apiApp).get("/api/v1/analytics/events");
      statuses.push(res.status);
      if (res.status === 429) break;
    }

    expect(statuses).toHaveLength(rateLimitConfig.apiMax + 1);
    expect(statuses[rateLimitConfig.apiMax]).toBe(429);
  });
});
