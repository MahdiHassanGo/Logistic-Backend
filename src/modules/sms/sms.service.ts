import { prisma } from "../../shared/database/prisma.js";
import { writeAuditLog } from "../../shared/audit/audit.js";
import { publishDomainEvent } from "../../shared/queue/domain-events.js";
import { createReference } from "../../shared/utils/reference.js";

// In-memory fallback config cache for SMS provider settings per shop
const smsSettingsMap = new Map<string, {
  provider: string;
  apiKey?: string;
  senderId?: string;
  autoSmsOnPurchase: boolean;
  autoSmsOnPayment: boolean;
}>();

export async function getSmsHistory(
  shopId: string,
  input: {
    page: number;
    limit: number;
    search?: string;
    status?: "SENT" | "PENDING" | "FAILED";
  }
) {
  const logs = await prisma.auditLog.findMany({
    where: {
      shopId,
      entityType: "SMS",
      ...(input.search ? { metadata: { path: ["recipient"], string_contains: input.search } } : {})
    },
    orderBy: { createdAt: "desc" },
    skip: (input.page - 1) * input.limit,
    take: input.limit
  });

  const total = await prisma.auditLog.count({
    where: { shopId, entityType: "SMS" }
  });

  const items = logs.map((log) => {
    const meta = (log.metadata as Record<string, any>) ?? {};
    return {
      id: log.id,
      recipient: meta.recipient ?? "Unknown",
      message: meta.message ?? "",
      status: meta.status ?? "SENT",
      sentAt: log.createdAt,
      error: meta.error ?? null
    };
  });

  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function resendSms(
  shopId: string,
  input: { smsId?: string; recipientPhone?: string; message?: string },
  actorId: string
) {
  const recipient = input.recipientPhone ?? "+8801700000000";
  const message = input.message ?? "LogiKhata transaction receipt reminder.";

  await writeAuditLog({
    shopId,
    actorId,
    action: "sms.resend",
    entityType: "SMS",
    entityId: input.smsId ?? createReference("SMS"),
    metadata: { recipient, message, status: "SENT", provider: smsSettingsMap.get(shopId)?.provider ?? "MOCK" }
  });

  await publishDomainEvent("sms.send", {
    eventId: createReference("EVT"),
    shopId,
    recipient,
    message
  });

  return { success: true, message: "SMS dispatched successfully", recipient };
}

export async function getSmsSettings(shopId: string) {
  return smsSettingsMap.get(shopId) ?? {
    provider: "MOCK",
    apiKey: "••••••••••••",
    senderId: "LOGIKHATA",
    autoSmsOnPurchase: true,
    autoSmsOnPayment: true
  };
}

export async function updateSmsSettings(
  shopId: string,
  input: {
    provider: string;
    apiKey?: string;
    senderId?: string;
    autoSmsOnPurchase: boolean;
    autoSmsOnPayment: boolean;
  },
  actorId: string
) {
  smsSettingsMap.set(shopId, input);

  await writeAuditLog({
    shopId,
    actorId,
    action: "settings.sms.update",
    entityType: "Settings",
    entityId: shopId,
    metadata: { provider: input.provider, senderId: input.senderId, autoSmsOnPurchase: input.autoSmsOnPurchase, autoSmsOnPayment: input.autoSmsOnPayment }
  });

  return getSmsSettings(shopId);
}
