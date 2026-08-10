import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createCustomerController,
  customerLedgerController,
  getCustomerController,
  listCustomersController,
  updateCustomerController
} from "./customer.controller.js";
import {
  createCustomerSchema,
  customerIdParamsSchema,
  customerLedgerQuerySchema,
  customerListQuerySchema,
  updateCustomerSchema
} from "./customer.schemas.js";

export const customerRouter = Router();
customerRouter.get(
  "/",
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  validate({ query: customerListQuerySchema }),
  listCustomersController
);
customerRouter.post(
  "/",
  requirePermission(PERMISSIONS.CUSTOMER_CREATE),
  validate({ body: createCustomerSchema }),
  createCustomerController
);
customerRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  validate({ params: customerIdParamsSchema }),
  getCustomerController
);
customerRouter.patch(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: customerIdParamsSchema, body: updateCustomerSchema }),
  updateCustomerController
);
customerRouter.get(
  "/:id/ledger",
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  validate({ params: customerIdParamsSchema, query: customerLedgerQuerySchema }),
  customerLedgerController
);
