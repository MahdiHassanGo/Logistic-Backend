import { z } from "zod";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);

export const createProductSchema = z.strictObject({
  code: z.string().trim().toUpperCase().min(2).max(50),
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
  unit: z.string().trim().min(1).max(30),
  defaultPrice: money,
  isActive: z.boolean().default(true)
});

export const updateProductSchema = createProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);

export const productIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const productListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional()
});
