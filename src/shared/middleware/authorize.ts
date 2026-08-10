import type { RequestHandler } from "express";
import type { PermissionKey } from "../auth/permissions.js";
import { getEffectivePermissions } from "../auth/permissions.js";
import { errors } from "../errors/app-error.js";

export function requirePermission(permission: PermissionKey): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) throw errors.unauthorized();
    const permissions = await getEffectivePermissions(req.auth.userId, req.auth.role);
    if (!permissions.has("*") && !permissions.has(permission)) {
      throw errors.forbidden();
    }
    next();
  };
}
