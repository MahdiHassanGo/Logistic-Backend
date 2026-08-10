import type { Request, Response } from "express";
import { prisma } from "../../shared/database/prisma.js";
import { redis } from "../../shared/queue/redis.js";

export function livenessController(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      status: "alive",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
}

export async function readinessController(_req: Request, res: Response) {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ready";
  } catch {
    checks.database = "unavailable";
  }

  try {
    if (redis.status === "wait") await redis.connect();
    checks.redis = (await redis.ping()) === "PONG" ? "ready" : "unavailable";
  } catch {
    checks.redis = "unavailable";
  }

  const ready = Object.values(checks).every((status) => status === "ready");
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { status: ready ? "ready" : "not_ready", checks, timestamp: new Date().toISOString() }
  });
}
