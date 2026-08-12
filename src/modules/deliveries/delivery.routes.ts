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
  listDriversController,
  listVehiclesController,
  updateDeliveryStatusController,
  updateDriverController,
  updateVehicleController
} from "./delivery.controller.js";
import {
  createDeliverySchema,
  createDriverSchema,
  createVehicleSchema,
  deliveryIdParamsSchema,
  deliveryListQuerySchema,
  driverIdParamsSchema,
  driverListQuerySchema,
  updateDeliveryStatusSchema,
  updateDriverSchema,
  updateVehicleSchema,
  vehicleIdParamsSchema,
  vehicleListQuerySchema
} from "./delivery.schemas.js";

export const deliveryRouter = Router();

deliveryRouter.get(
  "/drivers",
  requirePermission(PERMISSIONS.DELIVERY_READ),
  validate({ query: driverListQuerySchema }),
  listDriversController
);
deliveryRouter.post(
  "/drivers",
  requirePermission(PERMISSIONS.DELIVERY_ASSIGN),
  validate({ body: createDriverSchema }),
  createDriverController
);
deliveryRouter.patch(
  "/drivers/:id",
  requirePermission(PERMISSIONS.DRIVER_UPDATE),
  validate({ params: driverIdParamsSchema, body: updateDriverSchema }),
  updateDriverController
);

deliveryRouter.get(
  "/vehicles",
  requirePermission(PERMISSIONS.DELIVERY_READ),
  validate({ query: vehicleListQuerySchema }),
  listVehiclesController
);
deliveryRouter.post(
  "/vehicles",
  requirePermission(PERMISSIONS.DELIVERY_ASSIGN),
  validate({ body: createVehicleSchema }),
  createVehicleController
);
deliveryRouter.patch(
  "/vehicles/:id",
  requirePermission(PERMISSIONS.VEHICLE_UPDATE),
  validate({ params: vehicleIdParamsSchema, body: updateVehicleSchema }),
  updateVehicleController
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
