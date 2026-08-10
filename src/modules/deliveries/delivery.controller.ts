import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import {
  createDelivery,
  createDriver,
  createVehicle,
  getDelivery,
  listDeliveries,
  updateDeliveryStatus
} from "./delivery.service.js";

export async function createDriverController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  res.status(201).json({
    success: true,
    data: await createDriver(req.validated?.body as Parameters<typeof createDriver>[0], req.auth.shopId)
  });
}

export async function createVehicleController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  res.status(201).json({
    success: true,
    data: await createVehicle(req.validated?.body as Parameters<typeof createVehicle>[0], req.auth.shopId)
  });
}

export async function createDeliveryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  res.status(201).json({
    success: true,
    data: await createDelivery(
      req.validated?.body as Parameters<typeof createDelivery>[0],
      req.auth.shopId,
      req.auth.userId
    )
  });
}

export async function updateDeliveryStatusController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({
    success: true,
    data: await updateDeliveryStatus(
      id,
      req.auth.shopId,
      req.validated?.body as Parameters<typeof updateDeliveryStatus>[2],
      req.auth.userId
    )
  });
}

export async function getDeliveryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  res.json({ success: true, data: await getDelivery(id, req.auth.shopId) });
}

export async function listDeliveriesController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await listDeliveries(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof listDeliveries>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}
