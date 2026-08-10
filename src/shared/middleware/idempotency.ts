import type { RequestHandler } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../database/prisma.js";
import { errors } from "../errors/app-error.js";
import { hashPayload } from "../security/hash.js";

export function idempotency(scope: string): RequestHandler {
  return async (req, res, next) => {
    if (!req.auth) throw errors.unauthorized();
    const key = req.header("idempotency-key");
    if (!key || key.length < 8 || key.length > 128) {
      throw errors.badRequest(
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header must contain 8 to 128 characters"
      );
    }

    const requestHash = hashPayload({
      method: req.method,
      path: req.originalUrl,
      body: req.validated?.body ?? req.body
    });

    let record = await prisma.idempotencyKey.findUnique({
      where: { shopId_actorId_scope_key: { shopId: req.auth.shopId, actorId: req.auth.userId, scope, key } }
    });

    if (record?.expiresAt && record.expiresAt <= new Date()) {
      await prisma.idempotencyKey.delete({ where: { id: record.id } });
      record = null;
    }

    if (record) {
      if (record.requestHash !== requestHash) {
        throw errors.conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used with a different request"
        );
      }
      if (record.status === "COMPLETED" && record.responseStatus && record.responseBody !== null) {
        res.status(record.responseStatus).json(record.responseBody);
        return;
      }
      throw errors.conflict("REQUEST_IN_PROGRESS", "An identical request is already being processed");
    }

    try {
      record = await prisma.idempotencyKey.create({
        data: {
          shopId: req.auth.shopId,
          actorId: req.auth.userId,
          scope,
          key,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("REQUEST_IN_PROGRESS", "An identical request is already being processed");
      }
      throw error;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      void prisma.idempotencyKey
        .update({
          where: { id: record!.id },
          data: {
            status: "COMPLETED",
            responseStatus: res.statusCode,
            responseBody: JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue
          }
        })
        .catch(() => undefined);
      return originalJson(body);
    }) as typeof res.json;

    res.on("finish", () => {
      if (res.statusCode >= 500) {
        void prisma.idempotencyKey.delete({ where: { id: record!.id } }).catch(() => undefined);
      }
    });

    next();
  };
}
