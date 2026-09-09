import { Router } from "express";

const analyticsRouter = Router();

analyticsRouter.get("/", (req, res) => {
  res.json({ message: "Analytics endpoint" });
});

export { analyticsRouter };
