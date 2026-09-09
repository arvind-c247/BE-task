import { Router } from "express";
import { analyticsRouter } from "../analytics/analytics.routes";

const router = Router();

router.use("/analytics", analyticsRouter);

export default router;
