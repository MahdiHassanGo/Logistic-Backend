import { z } from "zod";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
const quantity = z.string().regex(/^\d{1,12}(\.\d{1,3})?$/);

const purchaseItemSchema = z
  .strictObject({
    productId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(180).optional(),
    unit: z.string().trim().min(1).max(30).optional(),
    quantity,
    unitPrice: money.optional(),
    discount: money.default("0"),
    note: z.string().trim().max(500).optional()
  })
  .refine((item) => item.productId || (item.name && item.unit && item.unitPrice), {
    message: "Custom items require name, unit, and unitPrice"
  });

const initialPaymentSchema = z.strictObject({
  amount: money,
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_BANKING", "CHEQUE", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional()
});

const deliverySchema = z.strictObject({
  address: z.string().trim().min(3).max(500),
  contact: z.string().trim().min(7).max(100),
  scheduledAt: z.iso.datetime().optional(),
  transportCharge: money.default("0"),
  notes: z.string().trim().max(1000).optional()
});

export const createPurchaseSchema = z.strictObject({
  customerId: z.string().uuid(),
  purchaseDate: z.iso.datetime().optional(),
  items: z.array(purchaseItemSchema).min(1).max(100),
  discount: money.default("0"),
  notes: z.string().trim().max(1500).optional(),
  initialPayment: initialPaymentSchema.optional(),
  delivery: deliverySchema.optional()
});

export const purchaseIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const purchaseListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "VOIDED"]).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional()
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
