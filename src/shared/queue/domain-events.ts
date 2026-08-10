import { Queue } from "bullmq";
import { logger } from "../../config/logger.js";
import { redis } from "./redis.js";

export const domainEventsQueue = new Queue("domain-events", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000
  }
});

export async function publishDomainEvent(name: string, payload: Record<string, unknown>): Promise<void> {
  try {
    if (redis.status === "wait") await redis.connect();
    await domainEventsQueue.add(name, payload, {
      jobId: typeof payload.eventId === "string" ? payload.eventId : undefined
    });
  } catch (error) {
    logger.error({ err: error, eventName: name }, "failed to publish domain event");
  }
}
