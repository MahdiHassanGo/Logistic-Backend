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

async function dispatchGatewaySms(
  settings: { provider: string; apiKey?: string; senderId?: string },
  recipient: string,
  message: string
): Promise<{ success: boolean; provider: string; details?: string }> {
  const provider = settings.provider?.toUpperCase() || "MOCK";
  const apiKey = settings.apiKey || process.env.SMS_API_KEY;
  const senderId = settings.senderId || process.env.SMS_SENDER_ID || "LOGIKHATA";

  let cleanPhone = recipient.replace(/\D/g, "");
  if (cleanPhone.startsWith("88")) {
    cleanPhone = cleanPhone.substring(2);
  }
  if (!cleanPhone.startsWith("0")) {
    cleanPhone = "0" + cleanPhone;
  }

  if (provider === "MOCK") {
    return { success: true, provider: "MOCK", details: "Mock SMS dispatched to log" };
  }

  try {
    if (provider === "GREENWEB") {
      const token = apiKey || "DEMO_TOKEN";
      const params = new URLSearchParams({
        token,
        to: cleanPhone,
        message
      });
      const res = await fetch(`https://api.greenweb.com.bd/api.php?${params.toString()}`);
      const text = await res.text();
      return { success: res.ok, provider: "GREENWEB", details: text };
    }

    if (provider === "BULKSMSBD") {
      const key = apiKey || "DEMO_KEY";
      const params = new URLSearchParams({
        api_key: key,
        type: "text",
        number: cleanPhone,
        senderid: senderId,
        message
      });
      const res = await fetch(`http://bulksmsbd.net/api/smsapi?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      return { success: res.ok && data?.response_code === 202, provider: "BULKSMSBD", details: JSON.stringify(data) };
    }

    if (provider === "SSLWIRELESS") {
      const token = apiKey || "DEMO_TOKEN";
      const body = {
        api_token: token,
        sid: senderId,
        msisdn: "88" + cleanPhone,
        sms: message,
        csms_id: Date.now().toString()
      };
      const res = await fetch("https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, provider: "SSLWIRELESS", details: JSON.stringify(data) };
    }
  } catch (err: any) {
    return { success: false, provider, details: err.message };
  }

  return { success: true, provider: "MOCK", details: "Mock SMS dispatched" };
}

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
      provider: meta.provider ?? "MOCK",
      details: meta.details ?? null,
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
  const settings = await getSmsSettings(shopId);

  const dispatchResult = await dispatchGatewaySms(settings, recipient, message);

  await writeAuditLog({
    shopId,
    actorId,
    action: "sms.resend",
    entityType: "SMS",
    entityId: input.smsId ?? createReference("SMS"),
    metadata: {
      recipient,
      message,
      status: dispatchResult.success ? "SENT" : "FAILED",
      provider: dispatchResult.provider,
      details: dispatchResult.details
    }
  });

  await publishDomainEvent("sms.send", {
    eventId: createReference("EVT"),
    shopId,
    recipient,
    message
  });

  return {
    success: dispatchResult.success,
    message: dispatchResult.provider === "MOCK"
      ? "SMS recorded in system (MOCK mode). Connect SMS Gateway in Settings -> SMS for live delivery."
      : `SMS dispatched via ${dispatchResult.provider}`,
    provider: dispatchResult.provider,
    recipient
  };
}

export async function getSmsSettings(shopId: string) {
  return smsSettingsMap.get(shopId) ?? {
    provider: process.env.SMS_PROVIDER || "MOCK",
    apiKey: process.env.SMS_API_KEY || "",
    senderId: process.env.SMS_SENDER_ID || "LOGIKHATA",
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
