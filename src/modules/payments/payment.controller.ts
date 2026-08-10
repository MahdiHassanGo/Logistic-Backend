import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { createPayment, getPayment, listPayments, reversePayment } from "./payment.service.js";
import type { CreatePaymentInput } from "./payment.schemas.js";

export async function createPaymentController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await createPayment(
    req.validated?.body as CreatePaymentInput,
    req.auth.shopId,
    req.auth.userId
  );
  res.status(201).json({ success: true, data });
}

export async function reversePaymentController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const { reason } = req.validated?.body as { reason: string };
  res.json({ success: true, data: await reversePayment(id, req.auth.shopId, reason, req.auth.userId) });
}

export async function getPaymentController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({ success: true, data: await getPayment(id, req.auth.shopId) });
}

export async function listPaymentsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listPayments(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listPayments>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}
