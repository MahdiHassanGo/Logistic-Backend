import type { RequestHandler } from "express";
import { prisma } from "../database/prisma.js";
import { errors } from "../errors/app-error.js";
import { verifyAccessToken } from "../auth/jwt.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw errors.unauthorized();
  }

  const claims = verifyAccessToken(authorization.slice("Bearer ".length));
  const [user, session] = await Promise.all([
    prisma.user.findFirst({
      where: { id: claims.sub, status: "ACTIVE", deletedAt: null },
      select: { id: true, shopId: true, role: true }
    }),
    prisma.refreshSession.findUnique({
      where: { id: claims.sid },
      select: { revokedAt: true, expiresAt: true, userId: true }
    })
  ]);

  if (!user || !session || session.userId !== user.id || session.revokedAt || session.expiresAt <= new Date()) {
    throw errors.unauthorized("Session is no longer active");
  }

  req.auth = { userId: user.id, shopId: user.shopId, role: user.role, sessionId: claims.sid };
  next();
};
