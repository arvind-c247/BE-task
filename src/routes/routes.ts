import { Router } from "express";
import { analyticsRouter } from "../analytics/analytics.routes";
import { urlsRouter } from "../urls/urls.routes";
import { apiRateLimiter } from "../shared/middleware/rateLimit";
import { auth } from "../shared/middleware/auth";

const router = Router();

// Global API rate limiting (per IP) — applies to every route under /api/v1.
router.use(apiRateLimiter);

// Auth (authentication + authorization, stubbed — always lets requests
// through). Runs on every operation mounted below; add real checks inside
// src/shared/middleware/auth.ts when ready.
router.use(auth);

router.use("/analytics", analyticsRouter);
router.use(urlsRouter);

export default router;
