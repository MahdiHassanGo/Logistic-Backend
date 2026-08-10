import { randomBytes } from "node:crypto";

export function createReference(prefix: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  return `${prefix}-${day}-${suffix}`;
}
