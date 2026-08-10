import type { Prisma } from "../../generated/prisma/client.js";

export const SERIALIZABLE_TRANSACTION_OPTIONS = {
  isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel,
  maxWait: 5_000,
  timeout: 15_000
};
