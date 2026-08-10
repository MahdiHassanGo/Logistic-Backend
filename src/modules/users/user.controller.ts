import type { Request, Response } from "express";
import type { UserRole } from "../../generated/prisma/client.js";
import { errors } from "../../shared/errors/app-error.js";
import {
  createUser,
  listUsers,
  replaceUserPermissionOverrides,
  updateUserStatus
} from "./user.service.js";

export async function createUserController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const data = await createUser(
    req.validated?.body as Parameters<typeof createUser>[0],
    req.auth.shopId,
    req.auth.role
  );
  res.status(201).json({ success: true, data });
}

export async function listUsersController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const query = req.validated?.query as {
    page: number;
    limit: number;
    role?: UserRole;
    status?: "ACTIVE" | "INACTIVE" | "LOCKED";
    search?: string;
  };
  const result = await listUsers(req.auth.shopId, query);
  res.json({ success: true, data: result.items, meta: result });
}

export async function updateUserStatusController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const { status } = req.validated?.body as { status: "ACTIVE" | "INACTIVE" | "LOCKED" };
  const data = await updateUserStatus(id, req.auth.shopId, status, req.auth.userId);
  res.json({ success: true, data });
}

export async function updateUserPermissionsController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const { id } = req.validated?.params as { id: string };
  const data = await replaceUserPermissionOverrides(
    id,
    req.auth.shopId,
    req.validated?.body as { allow: string[]; deny: string[] }
  );
  res.json({ success: true, data });
}
