import type { Request, Response } from "express";
import { errors } from "../../shared/errors/app-error.js";
import { getSmsHistory, getSmsSettings, resendSms, updateSmsSettings } from "./sms.service.js";

export async function getSmsHistoryController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const result = await getSmsHistory(
    req.auth.shopId,
    req.validated?.query as Parameters<typeof getSmsHistory>[1]
  );
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages }
  });
}

export async function resendSmsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await resendSms(
    req.auth.shopId,
    req.validated?.body as Parameters<typeof resendSms>[1],
    req.auth.userId
  );
  res.json({ success: true, data });
}

export async function getSmsSettingsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await getSmsSettings(req.auth.shopId);
  res.json({ success: true, data });
}

export async function updateSmsSettingsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await updateSmsSettings(
    req.auth.shopId,
    req.validated?.body as Parameters<typeof updateSmsSettings>[1],
    req.auth.userId
  );
  res.json({ success: true, data });
}
