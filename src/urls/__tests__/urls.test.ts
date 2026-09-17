import express from "express";
import request from "supertest";
import { describe, expect, it } from "@jest/globals";
import mainRouter from "../../routes/routes";
import { redirectRouter, urlsRouter } from "../urls.routes";
import { InMemoryUrlStore, UrlConflictError } from "../urls.repository";
import { generateShortCode } from "../urls.services";
import { errorHandler, notFoundHandler } from "../../shared/utils/errorHandler";

// Functional app: mounts only the URL router (no global api limiter).
const urlsApp = express();
urlsApp.use(express.json());
urlsApp.use("/api/v1", urlsRouter);
urlsApp.use(notFoundHandler);
urlsApp.use(errorHandler);

// Full wiring check through the real /api/v1 router.
const apiApp = express();
apiApp.use(express.json());
apiApp.use("/api/v1", mainRouter);
apiApp.use(notFoundHandler);
apiApp.use(errorHandler);

const redirectApp = express();
redirectApp.use(redirectRouter);
redirectApp.use(notFoundHandler);
redirectApp.use(errorHandler);

describe("URL shortening routes", () => {
  it("creates a short link from a valid URL", async () => {
    const res = await request(urlsApp)
      .post("/api/v1/shorten")
      .send({ url: "https://example.com/docs" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      shortCode: expect.any(String),
      originalUrl: "https://example.com/docs",
      clickCount: 0,
    });
    expect(res.body.shortCode).toHaveLength(6);
  });

  it("rejects an invalid URL", async () => {
    const res = await request(urlsApp)
      .post("/api/v1/shorten")
      .send({ url: "not-a-url" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("redirects to the original URL and reports the click in analytics", async () => {
    const created = await request(urlsApp)
      .post("/api/v1/shorten")
      .send({ url: "https://example.com/redirect-target" });
    const { shortCode } = created.body;

    const redirect = await request(redirectApp).get(`/${shortCode}`);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe("https://example.com/redirect-target");

    const analytics = await request(urlsApp).get(`/api/v1/analytics/${shortCode}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body).toMatchObject({
      shortCode,
      originalUrl: "https://example.com/redirect-target",
      clickCount: 1,
    });
  });

  it("returns 404 for an unknown short code", async () => {
    const res = await request(urlsApp).get("/api/v1/analytics/doesnotexist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "NOT_FOUND" });
  });

  it("lists shortened links with their click stats", async () => {
    const created = await request(urlsApp)
      .post("/api/v1/shorten")
      .send({ url: "https://example.com/listable" });
    const { shortCode } = created.body;

    const res = await request(urlsApp).get("/api/v1/urls");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      count: expect.any(Number),
      urls: expect.arrayContaining([
        expect.objectContaining({
          shortCode,
          originalUrl: "https://example.com/listable",
          clickCount: expect.any(Number),
        }),
      ]),
    });
    expect(res.body.urls[0]).toHaveProperty("clickCount");
  });

  it("returns a links-level summary excluding global event totals", async () => {
    const res = await request(apiApp).get("/api/v1/urls/stats");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalLinks: expect.any(Number),
      totalClicks: expect.any(Number),
      avgClicksPerLink: expect.any(Number),
      mostClicked: expect.any(Object),
    });
  });

  it("exposes per-code stats under /api/v1/urls/:code", async () => {
    const created = await request(urlsApp)
      .post("/api/v1/shorten")
      .send({ url: "https://example.com/aliased" });
    const { shortCode } = created.body;

    const res = await request(urlsApp).get(`/api/v1/urls/${shortCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      shortCode,
      originalUrl: "https://example.com/aliased",
      clickCount: 0,
    });
  });
});

describe("InMemoryUrlStore", () => {
  it("rejects duplicate short codes", () => {
    const store = new InMemoryUrlStore();
    store.create({ originalUrl: "https://example.com", shortCode: "abc123" });

    expect(() =>
      store.create({ originalUrl: "https://other.com", shortCode: "abc123" }),
    ).toThrow(UrlConflictError);
  });

  it("increments click counts per code and clears state", () => {
    const store = new InMemoryUrlStore();
    store.create({ originalUrl: "https://example.com", shortCode: "abc123" });

    store.incrementClick("abc123");
    store.incrementClick("abc123");

    const record = store.findByCode("abc123");
    expect(record?.clickCount).toBe(2);
    expect(store.findByCode("missing")).toBeUndefined();

    store.clear();
    expect(store.findByCode("abc123")).toBeUndefined();
  });

  it("lists records newest-first and computes link-only summaries", () => {
    const store = new InMemoryUrlStore();
    store.create({ originalUrl: "https://a.com", shortCode: "aaa111" });
    store.create({ originalUrl: "https://b.com", shortCode: "bbb222" });
    store.incrementClick("aaa111");
    store.incrementClick("aaa111");
    store.incrementClick("bbb222");

    const list = store.list({ limit: 10 });
    expect(list).toHaveLength(2);
    expect(list.map((record) => record.shortCode)).toEqual(
      expect.arrayContaining(["aaa111", "bbb222"]),
    );

    const summary = store.getSummary();
    expect(summary).toMatchObject({
      totalLinks: 2,
      totalClicks: 3,
      avgClicksPerLink: 2,
    });
    expect(summary.mostClicked?.shortCode).toBe("aaa111");
  });
});

describe("generateShortCode", () => {
  it("produces fixed-length alphanumeric codes", () => {
    const code = generateShortCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
  });
});