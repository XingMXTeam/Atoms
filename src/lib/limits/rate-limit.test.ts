/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { assertRateLimit } from "./rate-limit";

describe("assertRateLimit (REQ-6)", () => {
  it("allows when under device run and global token caps", async () => {
    const decision = await assertRateLimit("device-a", {
      preferredMode: "mock",
      deviceDailyRunLimit: 20,
      dailyTokenCap: 500_000,
      getDeviceUsage: async () => ({ runs: 3, tokens: 100 }),
      getGlobalTokens: async () => 1_000,
    });

    expect(decision).toEqual({ ok: true, mode: "mock" });
  });

  it("degrades to replay with 演示回放 when DEVICE_DAILY_RUN_LIMIT is exceeded", async () => {
    const decision = await assertRateLimit("device-a", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 20,
      dailyTokenCap: 500_000,
      getDeviceUsage: async () => ({ runs: 20, tokens: 10 }),
      getGlobalTokens: async () => 10,
    });

    expect(decision).toEqual({
      ok: false,
      mode: "replay",
      label: "演示回放",
    });
  });

  it("degrades to replay with 演示回放 when DAILY_TOKEN_CAP is exceeded", async () => {
    const decision = await assertRateLimit("device-a", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 20,
      dailyTokenCap: 500_000,
      getDeviceUsage: async () => ({ runs: 1, tokens: 100 }),
      getGlobalTokens: async () => 500_000,
    });

    expect(decision).toEqual({
      ok: false,
      mode: "replay",
      label: "演示回放",
    });
  });

  it("refuses with a Chinese message when replay cannot run", async () => {
    const decision = await assertRateLimit("device-a", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 20,
      dailyTokenCap: 500_000,
      replayAvailable: false,
      getDeviceUsage: async () => ({ runs: 99, tokens: 0 }),
      getGlobalTokens: async () => 0,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok && "refuse" in decision) {
      expect(decision.refuse).toBe(true);
      expect(decision.messageZh.length).toBeGreaterThan(0);
      expect(decision.messageZh).toMatch(/[一-鿿]/);
    } else {
      expect.fail("expected refuse decision");
    }
  });
});
