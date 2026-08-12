import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { getInvoice, listInvoices, renderInvoicePdf } from "./invoice.service.js";

export async function listInvoicesController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listInvoices(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listInvoices>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}

export async function getInvoiceController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const data = await getInvoice(id, req.auth.shopId);
  res.json({ success: true, data });
}

export async function renderInvoicePdfController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const pdf = await renderInvoicePdf(id, req.auth.shopId);

  res.setHeader("Content-Type", pdf.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${pdf.filename}"`);
  res.send(pdf.content);
}
