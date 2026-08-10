import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { getEffectivePermissions } from "../../shared/auth/permissions.js";
import { errors } from "../../shared/errors/app-error.js";
import type { LoginInput } from "./auth.schemas.js";
import {
  getCurrentUser,
  login,
  revokeRefreshToken,
  revokeSession,
  rotateRefreshToken
} from "./auth.service.js";

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict" as const,
    path: `${env.API_PREFIX}/auth`,
    expires: expiresAt,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
  };
}

function clearCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: `${env.API_PREFIX}/auth`,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
  });
}

export async function loginController(req: Request, res: Response) {
  const input = req.validated?.body as LoginInput;
  const result = await login(input, { ipAddress: req.ip, userAgent: req.get("user-agent") });

  if (result.clientType === "WEB") {
    res.cookie(env.COOKIE_NAME, result.refreshToken, cookieOptions(result.refreshExpiresAt));
  }

  res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      ...(result.clientType === "MOBILE" ? { refreshToken: result.refreshToken } : {})
    }
  });
}

export async function refreshController(req: Request, res: Response) {
  const body = (req.validated?.body ?? {}) as { refreshToken?: string };
  const rawToken = body.refreshToken ?? req.cookies?.[env.COOKIE_NAME];
  if (!rawToken) throw errors.unauthorized("Refresh token is required");

  const result = await rotateRefreshToken(rawToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  if (result.clientType === "WEB") {
    res.cookie(env.COOKIE_NAME, result.refreshToken, cookieOptions(result.refreshExpiresAt));
  }

  res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      ...(result.clientType === "MOBILE" ? { refreshToken: result.refreshToken } : {})
    }
  });
}

export async function logoutController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const suppliedRefreshToken = req.body?.refreshToken ?? req.cookies?.[env.COOKIE_NAME];
  await Promise.all([
    revokeSession(req.auth.sessionId),
    suppliedRefreshToken ? revokeRefreshToken(suppliedRefreshToken) : Promise.resolve()
  ]);
  clearCookie(res);
  res.status(204).send();
}

export async function meController(req: Request, res: Response) {
  if (!req.auth) throw errors.unauthorized();
  const [user, permissions] = await Promise.all([
    getCurrentUser(req.auth.userId),
    getEffectivePermissions(req.auth.userId, req.auth.role)
  ]);
  res.json({
    success: true,
    data: { user, permissions: [...permissions] }
  });
}
