import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";
import { z } from "zod";
import { ApiError } from "../utils/ApiError";
import { errorHandler, notFoundHandler } from "../utils/errorHandler";

const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api-error", () => {
    throw ApiError.notFound("Widget missing");
  });

  app.get("/zod-error", () => {
    z.string().parse(123); // throws ZodError
  });

  app.get("/fatal", () => {
    throw new Error("querystring secret");
  });

  app.post("/validation", () => {
    throw ApiError.validation("Invalid analytics payload", [
      { path: "type", message: "type is required" },
    ]);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe("global error handler", () => {
  it("formats ApiError with its status, code and message", async () => {
    const res = await request(buildApp()).get("/api-error");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "NOT_FOUND",
      message: "Widget missing",
    });
  });

  it("converts ZodError into a 400 VALIDATION_ERROR with issues", async () => {
    const res = await request(buildApp()).get("/zod-error");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Invalid request payload");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(typeof res.body.details[0].path).toBe("string");
  });

  it("includes details when an ApiError provides them", async () => {
    const res = await request(buildApp()).post("/validation");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "VALIDATION_ERROR",
      message: "Invalid analytics payload",
      details: [{ path: "type", message: "type is required" }],
    });
  });

  it("masks unknown errors as 500 INTERNAL_ERROR in production", async () => {
    const previous = process.env.NODE_ENV;
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    try {
      const res = await request(buildApp()).get("/fatal");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: "INTERNAL_ERROR",
        message: "Internal server error",
      });
      expect(logSpy).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
      logSpy.mockRestore();
    }
  });

  it("exposes the error message in non-production for debuggability", async () => {
    const previous = process.env.NODE_ENV;
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "development";

    try {
      const res = await request(buildApp()).get("/fatal");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("querystring secret");
    } finally {
      process.env.NODE_ENV = previous;
      logSpy.mockRestore();
    }
  });

  it("returns a consistent JSON 404 for unknown routes", async () => {
    const res = await request(buildApp()).get("/not/a/route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "NOT_FOUND",
      message: "Route not found",
    });
  });

  it("leaves successful responses untouched", async () => {
    const res = await request(buildApp()).get("/ok");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});