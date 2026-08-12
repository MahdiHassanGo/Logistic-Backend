import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  getInvoiceController,
  listInvoicesController,
  renderInvoicePdfController
} from "./invoice.controller.js";
import { invoiceIdParamsSchema, invoiceListQuerySchema } from "./invoice.schemas.js";

export const invoiceRouter = Router();

invoiceRouter.get(
  "/",
  requirePermission(PERMISSIONS.INVOICE_READ),
  validate({ query: invoiceListQuerySchema }),
  listInvoicesController
);

invoiceRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.INVOICE_READ),
  validate({ params: invoiceIdParamsSchema }),
  getInvoiceController
);

invoiceRouter.get(
  "/:id/pdf",
  requirePermission(PERMISSIONS.INVOICE_READ),
  validate({ params: invoiceIdParamsSchema }),
  renderInvoicePdfController
);
