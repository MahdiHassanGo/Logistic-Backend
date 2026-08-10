import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { idempotency } from "../../shared/middleware/idempotency.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createPaymentController,
  getPaymentController,
  listPaymentsController,
  reversePaymentController
} from "./payment.controller.js";
import {
  createPaymentSchema,
  paymentIdParamsSchema,
  paymentListQuerySchema,
  reversePaymentSchema
} from "./payment.schemas.js";

export const paymentRouter = Router();
paymentRouter.get(
  "/",
  requirePermission(PERMISSIONS.PAYMENT_READ),
  validate({ query: paymentListQuerySchema }),
  listPaymentsController
);
paymentRouter.post(
  "/",
  requirePermission(PERMISSIONS.PAYMENT_CREATE),
  validate({ body: createPaymentSchema }),
  idempotency("payment.create"),
  createPaymentController
);
paymentRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.PAYMENT_READ),
  validate({ params: paymentIdParamsSchema }),
  getPaymentController
);
paymentRouter.post(
  "/:id/reverse",
  requirePermission(PERMISSIONS.PAYMENT_REVERSE),
  validate({ params: paymentIdParamsSchema, body: reversePaymentSchema }),
  idempotency("payment.reverse"),
  reversePaymentController
);
