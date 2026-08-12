import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import {
  getBackupHistory,
  getCompanySettings,
  triggerBackup,
  triggerRestore,
  updateCompanySettings
} from "./settings.service.js";

export async function getCompanySettingsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await getCompanySettings(req.auth.shopId);
  res.json({ success: true, data });
}

export async function updateCompanySettingsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await updateCompanySettings(
    req.auth.shopId,
    req.validated?.body as Parameters<typeof updateCompanySettings>[1],
    req.auth.userId
  );
  res.json({ success: true, data });
}

export async function triggerBackupController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const body = req.validated?.body as { notes?: string };
  const data = await triggerBackup(req.auth.shopId, body?.notes, req.auth.userId);
  res.status(201).json({ success: true, data });
}

export async function getBackupHistoryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await getBackupHistory(req.auth.shopId);
  res.json({ success: true, data });
}

export async function triggerRestoreController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const body = req.validated?.body as { backupId: string };
  const data = await triggerRestore(req.auth.shopId, body.backupId, req.auth.userId);
  res.json({ success: true, data });
}
