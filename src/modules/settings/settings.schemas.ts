import { z } from "zod";

export const updateCompanySchema = z.strictObject({
  name: z.string().trim().min(2).max(150).optional(),
  code: z.string().trim().toUpperCase().min(2).max(50).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable()
});

export const triggerBackupSchema = z.strictObject({
  notes: z.string().trim().max(500).optional()
});

export const triggerRestoreSchema = z.strictObject({
  backupId: z.string().trim().min(1)
});
