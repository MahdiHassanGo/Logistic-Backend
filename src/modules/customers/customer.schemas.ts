import { z } from "zod";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/, "Use a positive decimal string with up to 2 decimals");

export const createCustomerSchema = z.strictObject({
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(20),
  alternatePhone: z.string().trim().min(7).max(20).optional().nullable(),
  businessName: z.string().trim().max(180).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  area: z.string().trim().max(100).optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1500).optional().nullable(),
  creditLimit: money.default("0"),
  openingBalance: money.default("0"),
  avatarUrl: z.string().url().optional().nullable()
});

export const updateCustomerSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    alternatePhone: z.string().trim().min(7).max(20).optional().nullable(),
    businessName: z.string().trim().max(180).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    area: z.string().trim().max(100).optional().nullable(),
    district: z.string().trim().max(100).optional().nullable(),
    notes: z.string().trim().max(1500).optional().nullable(),
    creditLimit: money.optional(),
    avatarUrl: z.string().url().optional().nullable(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const customerIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const customerListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  hasDue: z.enum(["true", "false"]).transform((value) => value === "true").optional()
});

export const customerLedgerQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
