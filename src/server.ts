import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { verifyAccessToken } from "./shared/auth/jwt.js";
import { prisma } from "./shared/database/prisma.js";
import { domainEventsQueue } from "./shared/queue/domain-events.js";
import { redis } from "./shared/queue/redis.js";

const app = createApp();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: env.CORS_ORIGINS, credentials: true },
  transports: ["websocket", "polling"]
});

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const headerToken = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
    const claims = verifyAccessToken(authToken ?? headerToken ?? "");
    socket.data.userId = claims.sub;
    socket.data.role = claims.role;
    socket.data.sessionId = claims.sid;
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.join(`role:${socket.data.role}`);
});

httpServer.on("error", (error) => {
  logger.fatal({ err: error }, "HTTP server error");
  void shutdown("httpServerError");
});

httpServer.listen(env.PORT, env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT, apiPrefix: env.API_PREFIX }, "LogiKhata API started");
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "graceful shutdown started");
  httpServer.close(async () => {
    const closeSocket = new Promise<void>((resolve) => io.close(() => resolve()));
    await Promise.allSettled([
      closeSocket,
      domainEventsQueue.close(),
      redis.quit(),
      prisma.$disconnect()
    ]);
    logger.info("graceful shutdown completed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "unhandled rejection");
  void shutdown("unhandledRejection");
});
