import type { UserRole } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        shopId: string;
        sessionId: string;
        role: UserRole;
      };
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
