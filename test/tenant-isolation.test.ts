import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/shared/auth/jwt.js";
import { canTransition } from "../src/modules/deliveries/delivery.service.js";

describe("Multi-Tenant Shop Isolation Architecture", () => {
  it("includes shopId in access token claims and verifies correctly", () => {
    const userId = "user-123";
    const shopId = "shop-456";
    const sessionId = "session-789";
    const role = "OWNER";

    const token = signAccessToken({ userId, shopId, sessionId, role });
    const claims = verifyAccessToken(token);

    expect(claims.sub).toBe(userId);
    expect(claims.shopId).toBe(shopId);
    expect(claims.sid).toBe(sessionId);
    expect(claims.role).toBe(role);
  });

  it("validates delivery state transitions independently of shop context", () => {
    expect(canTransition("PENDING", "ASSIGNED")).toBe(true);
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
  });
});
