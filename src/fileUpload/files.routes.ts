import { Router } from "express";
import { validate } from "../shared/middleware/validate";
import { fileDownloadRequestSchema } from "./schema/files.schema";
import { downloadFile, uploadFile } from "./files.controller";

// Mounted under /api/v1/file (see ../routes/routes.ts).
const fileRouter = Router();

fileRouter.post("/upload", uploadFile);
fileRouter.get("/download/:filename", validate(fileDownloadRequestSchema), downloadFile);

export { fileRouter };