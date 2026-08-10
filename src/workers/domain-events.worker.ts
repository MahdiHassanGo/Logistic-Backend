import { Worker } from "bullmq";
import { logger } from "../config/logger.js";
import { redis } from "../shared/queue/redis.js";

const worker = new Worker(
  "domain-events",
  async (job) => {
    switch (job.name) {
      case "purchase.created":
      case "payment.created":
      case "payment.reversed":
      case "delivery.updated":
        logger.info({ event: job.name, payload: job.data }, "domain event received");
        // Attach SMS, push, PDF, report-cache invalidation, or webhook adapters here.
        return { handled: true };
      default:
        logger.warn({ event: job.name }, "unhandled domain event");
        return { handled: false };
    }
  },
  {
    connection: redis,
    concurrency: 20,
    limiter: { max: 100, duration: 1_000 }
  }
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, event: job?.name, err: error }, "domain event job failed");
});
worker.on("error", (error) => logger.error({ err: error }, "domain event worker error"));

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutdown started");
  await worker.close();
  await redis.quit();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
