import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  exportReportController,
  getDueAgingController,
  getPaymentsReportController,
  getReportSummaryController,
  getSalesReportController
} from "./report.controller.js";
import { dateRangeQuerySchema, dueAgingQuerySchema, exportReportSchema } from "./report.schemas.js";

export const reportRouter = Router();

reportRouter.get(
  "/due-aging",
  requirePermission(PERMISSIONS.REPORT_READ),
  validate({ query: dueAgingQuerySchema }),
  getDueAgingController
);

reportRouter.get(
  "/summary",
  requirePermission(PERMISSIONS.REPORT_READ),
  validate({ query: dateRangeQuerySchema }),
  getReportSummaryController
);

reportRouter.get(
  "/sales",
  requirePermission(PERMISSIONS.REPORT_READ),
  validate({ query: dateRangeQuerySchema }),
  getSalesReportController
);

reportRouter.get(
  "/payments",
  requirePermission(PERMISSIONS.REPORT_READ),
  validate({ query: dateRangeQuerySchema }),
  getPaymentsReportController
);

reportRouter.post(
  "/export",
  requirePermission(PERMISSIONS.REPORT_EXPORT),
  validate({ body: exportReportSchema }),
  exportReportController
);
