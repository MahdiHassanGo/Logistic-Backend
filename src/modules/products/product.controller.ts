import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { createProduct, listProducts, updateProduct } from "./product.service.js";

export async function createProductController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await createProduct(
    req.validated?.body as Parameters<typeof createProduct>[0],
    req.auth.shopId,
    req.auth.userId
  );
  res.status(201).json({ success: true, data });
}

export async function listProductsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listProducts(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listProducts>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}

export async function updateProductController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({
    success: true,
    data: await updateProduct(
      id,
      req.auth.shopId,
      req.validated?.body as Parameters<typeof updateProduct>[2]
    )
  });
}
