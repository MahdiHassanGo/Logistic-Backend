import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log:
    env.NODE_ENV === "development"
      ? [
          { emit: "event", level: "query" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" }
        ]
      : [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" }
        ]
});

if (env.NODE_ENV === "development") {
  prisma.$on("query", (event) => {
    logger.debug({ durationMs: event.duration, query: event.query }, "database query");
  });
}

prisma.$on("warn", (event) => logger.warn({ message: event.message }, "prisma warning"));
prisma.$on("error", (event) => logger.error({ message: event.message }, "prisma error"));
