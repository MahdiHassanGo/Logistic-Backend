import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { dashboardSummaryController } from "./dashboard.controller.js";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardSummaryController);
