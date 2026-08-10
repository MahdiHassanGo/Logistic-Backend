import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_ISSUER: z.string().min(1).default("logikhata-api"),
  JWT_AUDIENCE: z.string().min(1).default("logikhata-clients"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  JWT_PRIVATE_KEY_BASE64: z.string().min(1),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),
  COOKIE_NAME: z.string().default("logikhata_refresh"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: booleanFromString.default(false),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  JWT_PRIVATE_KEY: Buffer.from(parsed.data.JWT_PRIVATE_KEY_BASE64, "base64").toString("utf8"),
  JWT_PUBLIC_KEY: Buffer.from(parsed.data.JWT_PUBLIC_KEY_BASE64, "base64").toString("utf8")
};
