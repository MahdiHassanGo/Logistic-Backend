import { z } from "zod";

export const dateRangeQuerySchema = z.strictObject({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const dueAgingQuerySchema = z.strictObject({
  customerId: z.string().uuid().optional()
});

export const exportReportSchema = z.strictObject({
  type: z.enum(["SALES", "PAYMENTS", "DUE_AGING"]),
  format: z.enum(["CSV", "EXCEL"]).default("CSV"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});
