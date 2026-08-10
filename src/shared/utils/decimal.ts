import { Prisma } from "../../generated/prisma/client.js";
import { errors } from "../errors/app-error.js";

export function decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function assertNonNegative(value: Prisma.Decimal, field: string): void {
  if (value.isNegative()) {
    throw errors.badRequest("NEGATIVE_MONEY_VALUE", `${field} cannot be negative`);
  }
}

export function invoiceStatus(total: Prisma.Decimal, paid: Prisma.Decimal) {
  if (paid.lte(0)) return "UNPAID" as const;
  if (paid.gte(total)) return "PAID" as const;
  return "PARTIALLY_PAID" as const;
}
