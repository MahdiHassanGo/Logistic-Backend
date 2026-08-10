import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import {
  createCustomer,
  getCustomer,
  getCustomerLedger,
  listCustomers,
  updateCustomer
} from "./customer.service.js";

export async function createCustomerController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await createCustomer(
    req.validated?.body as Parameters<typeof createCustomer>[0],
    req.auth.shopId,
    req.auth.userId
  );
  res.status(201).json({ success: true, data });
}

export async function listCustomersController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listCustomers(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listCustomers>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}

export async function getCustomerController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({ success: true, data: await getCustomer(id, req.auth.shopId) });
}

export async function updateCustomerController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({ success: true, data: await updateCustomer(id, req.auth.shopId, req.validated?.body as Parameters<typeof updateCustomer>[2]) });
}

export async function customerLedgerController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const { page, limit } = req.validated?.query as { page: number; limit: number };
  const result = await getCustomerLedger(id, req.auth.shopId, page, limit);
  res.json({
    success: true,
    data: result.items,
    meta: {
      currentBalance: result.customer.currentBalance,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages
    }
  });
}
