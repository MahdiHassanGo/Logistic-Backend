import type { UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../database/prisma.js";

export const PERMISSIONS = {
  USER_MANAGE: "user.manage",
  CUSTOMER_READ: "customer.read",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  PRODUCT_READ: "product.read",
  PRODUCT_CREATE: "product.create",
  PRODUCT_UPDATE: "product.update",
  PURCHASE_READ: "purchase.read",
  PURCHASE_CREATE: "purchase.create",
  PURCHASE_VOID: "purchase.void",
  PAYMENT_READ: "payment.read",
  PAYMENT_CREATE: "payment.create",
  PAYMENT_REVERSE: "payment.reverse",
  DELIVERY_READ: "delivery.read",
  DELIVERY_CREATE: "delivery.create",
  DELIVERY_ASSIGN: "delivery.assign",
  DELIVERY_UPDATE_STATUS: "delivery.update_status",
  DASHBOARD_READ: "dashboard.read",
  REPORT_READ: "report.read",
  REPORT_EXPORT: "report.export",
  SMS_RESEND: "sms.resend",
  SETTINGS_SMS: "settings.sms",
  SETTINGS_BACKUP: "settings.backup"
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export async function getEffectivePermissions(userId: string, role: UserRole): Promise<Set<string>> {
  if (role === "OWNER") return new Set(["*"]);

  const [rolePermissions, overrides] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role },
      select: { permission: { select: { key: true } } }
    }),
    prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { allow: true, permission: { select: { key: true } } }
    })
  ]);

  const permissions = new Set(rolePermissions.map((item) => item.permission.key));
  for (const override of overrides) {
    if (override.allow) permissions.add(override.permission.key);
    else permissions.delete(override.permission.key);
  }
  return permissions;
}
