import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import {
  exportReportData,
  getDueAging,
  getPaymentsReport,
  getReportSummary,
  getSalesReport
} from "./report.service.js";

export async function getDueAgingController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const query = req.validated?.query as { customerId?: string };
  const data = await getDueAging(req.auth.shopId, query?.customerId);
  res.json({ success: true, data });
}

export async function getReportSummaryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const query = req.validated?.query as { startDate?: string; endDate?: string };
  const data = await getReportSummary(req.auth.shopId, query?.startDate, query?.endDate);
  res.json({ success: true, data });
}

export async function getSalesReportController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const query = req.validated?.query as { startDate?: string; endDate?: string };
  const data = await getSalesReport(req.auth.shopId, query?.startDate, query?.endDate);
  res.json({ success: true, data });
}

export async function getPaymentsReportController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const query = req.validated?.query as { startDate?: string; endDate?: string };
  const data = await getPaymentsReport(req.auth.shopId, query?.startDate, query?.endDate);
  res.json({ success: true, data });
}

export async function exportReportController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const body = req.validated?.body as {
    type: "SALES" | "PAYMENTS" | "DUE_AGING";
    format: "CSV" | "EXCEL";
    startDate?: string;
    endDate?: string;
  };
  const report = await exportReportData(req.auth.shopId, body.type, body.format, body.startDate, body.endDate);

  res.setHeader("Content-Type", report.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  res.send(report.csv);
}
