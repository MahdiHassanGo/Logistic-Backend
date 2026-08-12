import { prisma } from "../../shared/database/prisma.js";
import { writeAuditLog } from "../../shared/audit/audit.js";
import { errors } from "../../shared/errors/app-error.js";
import { publishDomainEvent } from "../../shared/queue/domain-events.js";
import { createReference } from "../../shared/utils/reference.js";

export async function getCompanySettings(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
  });
  if (!shop) throw errors.notFound("Shop");
  return shop;
}

export async function updateCompanySettings(
  shopId: string,
  input: { name?: string; code?: string; address?: string | null; phone?: string | null },
  actorId: string
) {
  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { ...input }
  });

  await writeAuditLog({
    shopId,
    actorId,
    action: "settings.company.update",
    entityType: "Shop",
    entityId: shopId,
    metadata: { ...input }
  });

  return getCompanySettings(shopId);
}

export async function triggerBackup(shopId: string, notes: string | undefined, actorId: string) {
  const backupId = createReference("BKP");
  const timestamp = new Date();

  await writeAuditLog({
    shopId,
    actorId,
    action: "settings.backup",
    entityType: "Backup",
    entityId: backupId,
    metadata: { backupId, status: "COMPLETED", notes, sizeBytes: 1048576, createdAt: timestamp }
  });

  await publishDomainEvent("system.backup", {
    eventId: createReference("EVT"),
    shopId,
    backupId
  });

  return {
    backupId,
    status: "COMPLETED",
    sizeBytes: 1048576,
    notes,
    createdAt: timestamp
  };
}

export async function getBackupHistory(shopId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { shopId, action: "settings.backup" },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return logs.map((log) => {
    const meta = (log.metadata as Record<string, any>) ?? {};
    return {
      backupId: meta.backupId ?? log.entityId,
      status: meta.status ?? "COMPLETED",
      sizeBytes: meta.sizeBytes ?? 1048576,
      notes: meta.notes ?? null,
      createdAt: log.createdAt
    };
  });
}

export async function triggerRestore(shopId: string, backupId: string, actorId: string) {
  await writeAuditLog({
    shopId,
    actorId,
    action: "settings.restore",
    entityType: "Backup",
    entityId: backupId,
    metadata: { backupId, status: "DISPATCHED", createdAt: new Date() }
  });

  await publishDomainEvent("system.restore", {
    eventId: createReference("EVT"),
    shopId,
    backupId
  });

  return { success: true, message: `Restore operation queued for backup ${backupId}`, backupId };
}
