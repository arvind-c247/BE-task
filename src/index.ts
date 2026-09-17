import { env } from "./config/env";
import express from "express";
import router from "./routes/routes";
import { redirectRouter } from "./urls/urls.routes";
import { errorHandler, notFoundHandler } from "./shared/utils/errorHandler";

const app = express();

app.use(express.json());
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
