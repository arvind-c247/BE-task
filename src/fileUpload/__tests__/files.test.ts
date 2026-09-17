import fs from "fs/promises";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import fileUpload from "express-fileupload";
import { describe, expect, it } from "@jest/globals";
import { fileRouter } from "../files.routes";
import { errorHandler, notFoundHandler } from "../../shared/utils/errorHandler";
import type { UploadedFile } from "express-fileupload";
import { createFileRepository } from "../files.repository";
import { createFileService } from "../files.services";
import { ApiError } from "../../shared/utils/ApiError";

const app = express();
app.use(express.json());
app.use(fileUpload());
app.use("/api/v1/file", fileRouter);
app.use(notFoundHandler);
app.use(errorHandler);

describe("file upload routes", () => {
  it("uploads a file and returns its metadata", async () => {
    const res = await request(app)
      .post("/api/v1/file/upload")
      .attach("file", Buffer.from("hello world"), "hello.txt");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message: "File(s) uploaded successfully",
      files: [
        {
          name: "hello.txt",
          size: 11,
          url: "/api/v1/file/download/hello.txt",
        },
      ],
    });

    await fs.unlink(path.join(process.cwd(), "public", "files", "hello.txt")).catch(() => undefined);
  });

  it("rejects a request without a file field", async () => {
    const res = await request(app).post("/api/v1/file/upload").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "BAD_REQUEST" });
  });

  it("downloads an uploaded file", async () => {
    const uploaded = await request(app)
      .post("/api/v1/file/upload")
      .attach("file", Buffer.from("download me"), "dl.bin");
    const { name } = uploaded.body.files[0];

    const res = await request(app).get(`/api/v1/file/download/${name}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-length"]).toBe("11");

    await fs.unlink(path.join(process.cwd(), "public", "files", name)).catch(() => undefined);
  });

  it("returns 404 for a missing file", async () => {
    const res = await request(app).get("/api/v1/file/download/nope.txt");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "NOT_FOUND" });
  });
});

describe("file service", () => {
  it("dedupes stored names when a file already exists", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "file-svc-"));
    const service = createFileService(createFileRepository(dir));

    const fakeFile = (name: string) =>
      ({ name, size: 3, data: Buffer.from("abc"), mimetype: "text/plain" }) as unknown as UploadedFile;

    await service.upload(fakeFile("same.txt"));
    const second = await service.upload(fakeFile("same.txt"));

    expect(second[0].name).not.toBe("same.txt");
    expect(second[0].name).toMatch(/^same-\w{8}\.txt$/);
  });

  it("rejects files over the configured limit with 413", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "file-svc-"));
    const service = createFileService(createFileRepository(dir));

    const oversized = {
      name: "big.bin",
      size: 20 * 1024 * 1024,
      data: Buffer.alloc(0),
      mimetype: "application/octet-stream",
    } as unknown as UploadedFile;

    let caught: unknown;
    try {
      await service.upload(oversized);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).statusCode).toBe(413);
  });

  it("downloads back the exact bytes that were uploaded", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "file-svc-"));
    const service = createFileService(createFileRepository(dir));

    const file = {
      name: "data.txt",
      size: 5,
      data: Buffer.from("hello"),
      mimetype: "text/plain",
    } as unknown as UploadedFile;

    await service.upload(file);
    const downloaded = await service.download("data.txt");

    expect(downloaded?.data.toString()).toBe("hello");
    expect(downloaded?.name).toBe("data.txt");
    expect(service.download("../escape")).resolves.toBeNull();
  });
});