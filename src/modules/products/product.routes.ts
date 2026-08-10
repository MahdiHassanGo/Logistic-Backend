import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createProductController,
  listProductsController,
  updateProductController
} from "./product.controller.js";
import {
  createProductSchema,
  productIdParamsSchema,
  productListQuerySchema,
  updateProductSchema
} from "./product.schemas.js";

export const productRouter = Router();
productRouter.get(
  "/",
  requirePermission(PERMISSIONS.PRODUCT_READ),
  validate({ query: productListQuerySchema }),
  listProductsController
);
productRouter.post(
  "/",
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  validate({ body: createProductSchema }),
  createProductController
);
productRouter.patch(
  "/:id",
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  validate({ params: productIdParamsSchema, body: updateProductSchema }),
  updateProductController
);
