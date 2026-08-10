import { z } from "zod";

const userRole = z.enum(["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "OPERATOR", "DRIVER", "VIEWER"]);

export const createUserSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(50).regex(/^[a-z0-9._-]+$/),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  password: z.string().min(10).max(128),
  role: userRole.default("OPERATOR")
});

export const updateUserStatusSchema = z.strictObject({
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"])
});

export const updateUserPermissionsSchema = z.strictObject({
  allow: z.array(z.string().min(3).max(100)).max(100).default([]),
  deny: z.array(z.string().min(3).max(100)).max(100).default([])
}).refine((input) => !input.allow.some((key) => input.deny.includes(key)), {
  message: "The same permission cannot be both allowed and denied"
});

export const userIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const userListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: userRole.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
  search: z.string().trim().max(100).optional()
});
