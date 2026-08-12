import { z } from "zod";

export const invoiceIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const invoiceListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "VOIDED"]).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});
