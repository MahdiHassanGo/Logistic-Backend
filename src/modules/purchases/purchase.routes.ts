import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { idempotency } from "../../shared/middleware/idempotency.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createPurchaseController,
  getPurchaseController,
  listPurchasesController
} from "./purchase.controller.js";
import {
  createPurchaseSchema,
  purchaseIdParamsSchema,
  purchaseListQuerySchema
} from "./purchase.schemas.js";

export const purchaseRouter = Router();
purchaseRouter.get(
  "/",
  requirePermission(PERMISSIONS.PURCHASE_READ),
  validate({ query: purchaseListQuerySchema }),
  listPurchasesController
);
purchaseRouter.post(
  "/",
  requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate({ body: createPurchaseSchema }),
  idempotency("purchase.create"),
  createPurchaseController
);
purchaseRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.PURCHASE_READ),
  validate({ params: purchaseIdParamsSchema }),
  getPurchaseController
);
