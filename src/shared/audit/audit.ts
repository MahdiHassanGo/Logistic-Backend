import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../database/prisma.js";

export async function writeAuditLog(
  input: {
    shopId?: string;
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  return db.auditLog.create({ data: input });
}
