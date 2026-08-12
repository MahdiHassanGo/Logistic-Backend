import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  getBackupHistoryController,
  getCompanySettingsController,
  triggerBackupController,
  triggerRestoreController,
  updateCompanySettingsController
} from "./settings.controller.js";
import { triggerBackupSchema, triggerRestoreSchema, updateCompanySchema } from "./settings.schemas.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/company",
  requirePermission(PERMISSIONS.SETTINGS_COMPANY),
  getCompanySettingsController
);

settingsRouter.patch(
  "/company",
  requirePermission(PERMISSIONS.SETTINGS_COMPANY),
  validate({ body: updateCompanySchema }),
  updateCompanySettingsController
);

settingsRouter.post(
  "/backup",
  requirePermission(PERMISSIONS.SETTINGS_BACKUP),
  validate({ body: triggerBackupSchema }),
  triggerBackupController
);

settingsRouter.get(
  "/backup/history",
  requirePermission(PERMISSIONS.SETTINGS_BACKUP),
  getBackupHistoryController
);

settingsRouter.post(
  "/restore",
  requirePermission(PERMISSIONS.SETTINGS_BACKUP),
  validate({ body: triggerRestoreSchema }),
  triggerRestoreController
);
