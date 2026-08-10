import { z } from "zod";

export const loginSchema = z.strictObject({
  identifier: z.string().trim().min(3).max(150),
  password: z.string().min(8).max(128),
  clientType: z.enum(["WEB", "MOBILE"])
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(32).optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
