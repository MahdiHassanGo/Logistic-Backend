import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { idempotency } from "../../shared/middleware/idempotency.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createDeliveryController,
  createDriverController,
  createVehicleController,
  getDeliveryController,
  listDeliveriesController,
  updateDeliveryStatusController
} from "./delivery.controller.js";
import {
  createDeliverySchema,
  createDriverSchema,
  createVehicleSchema,
  deliveryIdParamsSchema,
  deliveryListQuerySchema,
  updateDeliveryStatusSchema
} from "./delivery.schemas.js";

export const deliveryRouter = Router();
deliveryRouter.post(
  "/drivers",
  requirePermission(PERMISSIONS.DELIVERY_ASSIGN),
  validate({ body: createDriverSchema }),
  createDriverController
);
deliveryRouter.post(
  "/vehicles",
  requirePermission(PERMISSIONS.DELIVERY_ASSIGN),
  validate({ body: createVehicleSchema }),
  createVehicleController
);
deliveryRouter.get(
  "/",
  requirePermission(PERMISSIONS.DELIVERY_READ),
  validate({ query: deliveryListQuerySchema }),
  listDeliveriesController
);
deliveryRouter.post(
  "/",
  requirePermission(PERMISSIONS.DELIVERY_CREATE),
  validate({ body: createDeliverySchema }),
  idempotency("delivery.create"),
  createDeliveryController
);
deliveryRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.DELIVERY_READ),
  validate({ params: deliveryIdParamsSchema }),
  getDeliveryController
);
deliveryRouter.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.DELIVERY_UPDATE_STATUS),
  validate({ params: deliveryIdParamsSchema, body: updateDeliveryStatusSchema }),
  idempotency("delivery.status"),
  updateDeliveryStatusController
);
