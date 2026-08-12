import { z } from "zod";

export const smsHistoryQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(["SENT", "PENDING", "FAILED"]).optional()
});

export const resendSmsSchema = z.strictObject({
  smsId: z.string().uuid().optional(),
  recipientPhone: z.string().trim().min(7).max(20).optional(),
  message: z.string().trim().min(1).max(1000).optional()
});

export const smsSettingsSchema = z.strictObject({
  provider: z.enum(["MOCK", "BULK_SMS_BD", "TWILIO"]).default("MOCK"),
  apiKey: z.string().trim().optional(),
  senderId: z.string().trim().optional(),
  autoSmsOnPurchase: z.boolean().default(true),
  autoSmsOnPayment: z.boolean().default(true)
});
