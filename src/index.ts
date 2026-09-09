import { env } from "./config/env";
import express from "express";
import router from "./routes/routes";

const app = express();

app.use(express.json());
app.use("/api/v1", router);

app.listen(env.PORT, () => {
  console.log(
    `Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`,
  );
});
