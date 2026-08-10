import { z } from "zod";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);

export const createPaymentSchema = z.strictObject({
  customerId: z.string().uuid(),
  paymentDate: z.iso.datetime().optional(),
  amount: money,
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_BANKING", "CHEQUE", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  attachmentUrl: z.string().url().optional(),
  allocations: z
    .array(
      z.strictObject({
        invoiceId: z.string().uuid(),
        amount: money
      })
    )
    .min(1)
    .max(100)
    .optional()
});

export const reversePaymentSchema = z.strictObject({
  reason: z.string().trim().min(5).max(500)
});

export const paymentIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const paymentListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  status: z.enum(["CONFIRMED", "REVERSED"]).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional()
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
