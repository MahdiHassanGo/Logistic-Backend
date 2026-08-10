import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "refreshToken",
      "accessToken",
      "tokenHash",
      "credentials"
    ],
    censor: "[REDACTED]"
  },
  base: {
    service: "logikhata-api",
    environment: env.NODE_ENV
  }
});
