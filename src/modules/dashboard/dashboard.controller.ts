import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { getDashboardSummary } from "./dashboard.service.js";

export async function dashboardSummaryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  res.json({ success: true, data: await getDashboardSummary(req.auth.shopId) });
}
