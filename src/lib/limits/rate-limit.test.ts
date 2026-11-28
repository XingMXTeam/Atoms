/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { utcDay, utcMonth } from "./rate-limit";

describe("usage calendar buckets", () => {
  it("formats UTC day and month", () => {
    const date = new Date("2026-11-28T16:05:00.000Z");
    expect(utcDay(date)).toBe("2026-11-28");
    expect(utcMonth(date)).toBe("2026-11");
  });
});
