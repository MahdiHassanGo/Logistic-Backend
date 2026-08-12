import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  getSmsHistoryController,
  getSmsSettingsController,
  resendSmsController,
  updateSmsSettingsController
} from "./sms.controller.js";
import { resendSmsSchema, smsHistoryQuerySchema, smsSettingsSchema } from "./sms.schemas.js";

export const smsRouter = Router();

smsRouter.get(
  "/history",
  requirePermission(PERMISSIONS.SMS_RESEND),
  validate({ query: smsHistoryQuerySchema }),
  getSmsHistoryController
);

smsRouter.post(
  "/resend",
  requirePermission(PERMISSIONS.SMS_RESEND),
  validate({ body: resendSmsSchema }),
  resendSmsController
);

smsRouter.get(
  "/settings",
  requirePermission(PERMISSIONS.SETTINGS_SMS),
  getSmsSettingsController
);

smsRouter.patch(
  "/settings",
  requirePermission(PERMISSIONS.SETTINGS_SMS),
  validate({ body: smsSettingsSchema }),
  updateSmsSettingsController
);
