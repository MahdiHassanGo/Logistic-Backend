import { randomUUID } from "node:crypto";
import type { ClientType } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { SERIALIZABLE_TRANSACTION_OPTIONS } from "../../shared/database/transaction.js";
import { errors } from "../../shared/errors/app-error.js";
import { signAccessToken } from "../../shared/auth/jwt.js";
import {
  createOpaqueToken,
  hashToken,
  verifyPassword
} from "../../shared/security/hash.js";
import { env } from "../../config/env.js";
import type { LoginInput } from "./auth.schemas.js";

interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function publicUser<T extends { passwordHash?: string }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function login(input: LoginInput, metadata: SessionMetadata) {
  const identifier = input.identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username: identifier }, { email: identifier.toLowerCase() }, { phone: identifier }]
    }
  });

  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw errors.unauthorized("Invalid username, email, phone, or password");
  }
  if (user.status !== "ACTIVE") {
    throw errors.forbidden("This user account is not active");
  }

  const rawRefreshToken = createOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: randomUUID(),
        clientType: input.clientType,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        expiresAt: refreshExpiry()
      }
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return created;
  }, SERIALIZABLE_TRANSACTION_OPTIONS);

  return {
    user: publicUser(user),
    accessToken: signAccessToken({ userId: user.id, shopId: user.shopId, sessionId: session.id, role: user.role }),
    refreshToken: rawRefreshToken,
    refreshExpiresAt: session.expiresAt,
    clientType: input.clientType
  };
}

export async function rotateRefreshToken(rawToken: string, metadata: SessionMetadata) {
  const currentHash = hashToken(rawToken);
  const nextRawToken = createOpaqueToken();
  const nextHash = hashToken(nextRawToken);

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.refreshSession.findUnique({
      where: { tokenHash: currentHash },
      include: { user: true }
    });

    if (!current) throw errors.unauthorized("Refresh token is invalid");

    if (current.revokedAt) {
      await tx.refreshSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      throw errors.unauthorized("Refresh token reuse was detected; the session family was revoked");
    }

    if (current.expiresAt <= new Date() || current.user.status !== "ACTIVE" || current.user.deletedAt) {
      await tx.refreshSession.update({
        where: { id: current.id },
        data: { revokedAt: new Date() }
      });
      throw errors.unauthorized("Refresh session has expired or is inactive");
    }

    await tx.refreshSession.update({
      where: { id: current.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedByTokenHash: nextHash
      }
    });

    const next = await tx.refreshSession.create({
      data: {
        userId: current.userId,
        tokenHash: nextHash,
        familyId: current.familyId,
        clientType: current.clientType,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        expiresAt: refreshExpiry()
      }
    });

    return { user: current.user, session: next, clientType: current.clientType };
  }, SERIALIZABLE_TRANSACTION_OPTIONS);

  return {
    user: publicUser(result.user),
    accessToken: signAccessToken({
      userId: result.user.id,
      shopId: result.user.shopId,
      sessionId: result.session.id,
      role: result.user.role
    }),
    refreshToken: nextRawToken,
    refreshExpiresAt: result.session.expiresAt,
    clientType: result.clientType
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      shopId: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      shop: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true
        }
      }
    }
  });
  if (!user) throw errors.notFound("User");
  return user;
}
