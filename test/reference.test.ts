import { describe, expect, it } from "vitest";
import { createReference } from "../src/shared/utils/reference.js";

describe("createReference", () => {
  it("creates unique date-prefixed references", () => {
    const date = new Date("2026-08-06T10:00:00.000Z");
    const first = createReference("INV", date);
    const second = createReference("INV", date);
    expect(first).toMatch(/^INV-20260806-[A-F0-9]{10}$/);
    expect(second).not.toBe(first);
  });
});
