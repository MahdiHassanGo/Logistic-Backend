import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { createPurchase, getPurchase, listPurchases } from "./purchase.service.js";
import type { CreatePurchaseInput } from "./purchase.schemas.js";

export async function createPurchaseController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await createPurchase(
    req.validated?.body as CreatePurchaseInput,
    req.auth.shopId,
    req.auth.userId
  );
  res.status(201).json({ success: true, data });
}

export async function getPurchaseController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({ success: true, data: await getPurchase(id, req.auth.shopId) });
}

export async function listPurchasesController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listPurchases(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listPurchases>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}
