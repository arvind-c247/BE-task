import fs from "fs";
import { env } from "./config/env";
import express from "express";
import fileUpload from "express-fileupload";
import { FILE_UPLOAD_MAX_BYTES, FILES_DIR } from "./config/fileUpload";
import router from "./routes/routes";
import { redirectRouter } from "./urls/urls.routes";
import { errorHandler, notFoundHandler } from "./shared/utils/errorHandler";

// Make sure the upload directory exists before any file is stored.
fs.mkdirSync(FILES_DIR, { recursive: true });

const app = express();

app.use(express.json());
app.use(
  fileUpload({
    limits: { fileSize: FILE_UPLOAD_MAX_BYTES },
    abortOnLimit: true,
    limitHandler: (_req, res) => {
      res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: "File exceeds the upload size limit",
      });
    },
  }),
);
app.use("/api/v1", router);
// Short-link redirects live at the root (GET /:code).
app.use(redirectRouter);

// Global API error handling — must be registered after all routes.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(
    `Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`,
  );
});