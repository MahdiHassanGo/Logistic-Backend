import { describe, expect, it } from "vitest";
import { loginSchema } from "../src/modules/auth/auth.schemas.js";

describe("loginSchema", () => {
  it("accepts a supported mobile login", () => {
    expect(
      loginSchema.safeParse({ identifier: "owner", password: "strong-password", clientType: "MOBILE" }).success
    ).toBe(true);
  });

  it("rejects unknown request fields", () => {
    expect(
      loginSchema.safeParse({
        identifier: "owner",
        password: "strong-password",
        clientType: "WEB",
        admin: true
      }).success
    ).toBe(false);
  });
});
