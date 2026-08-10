import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { UserRole } from "../../generated/prisma/client.js";
import { errors } from "../errors/app-error.js";

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  sid: string;
  shopId: string;
  role: UserRole;
  type: "access";
}

export function signAccessToken(input: {
  userId: string;
  shopId: string;
  sessionId: string;
  role: UserRole;
}): string {
  const options: SignOptions = {
    algorithm: "RS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    subject: input.userId,
    jwtid: randomUUID()
  };

  return jwt.sign(
    {
      sid: input.sessionId,
      shopId: input.shopId,
      role: input.role,
      type: "access"
    },
    env.JWT_PRIVATE_KEY,
    options
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, {
      algorithms: ["RS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    });

    if (
      typeof decoded === "string" ||
      decoded.type !== "access" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.sid !== "string" ||
      typeof decoded.shopId !== "string" ||
      typeof decoded.role !== "string"
    ) {
      throw errors.unauthorized("Invalid access token");
    }

    return decoded as AccessTokenClaims;
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    throw errors.unauthorized("Access token is invalid or expired");
  }
}
