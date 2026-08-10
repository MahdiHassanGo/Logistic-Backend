import { Router } from "express";
import { livenessController, readinessController } from "./health.controller.js";

export const healthRouter = Router();
healthRouter.get("/live", livenessController);
healthRouter.get("/ready", readinessController);
