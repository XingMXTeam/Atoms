/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { decidePlatformAccess } from "./demo-policy";

const base = {
  kind: "initial" as const,
  providerMode: "gemini" as const,
  hasByok: false,
  useReplay: false,
  deviceGenerations: 0,
  demoGenerationLimit: 1,
  platformTokensToday: 0,
  platformDailyCap: 50_000,
  platformTokensMonth: 0,
  platformMonthlyCap: 300_000,
  turnstileOk: true,
};

describe("decidePlatformAccess", () => {
  it("allows the first platform demo generation", () => {
    expect(decidePlatformAccess(base)).toEqual({
      ok: true,
      billing: "platform",
      mode: "gemini",
    });
  });

  it("refuses a second platform generation and offers replay", () => {
    const decision = decidePlatformAccess({ ...base, deviceGenerations: 1 });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("demo_exhausted");
      expect(decision.replayAvailable).toBe(true);
      expect(decision.messageZh).toMatch(/API Key/);
    }
  });

  it("refuses continue on platform keys even before the demo is used", () => {
    const decision = decidePlatformAccess({ ...base, kind: "continue" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("byok_required");
      expect(decision.replayAvailable).toBe(false);
    }
  });

  it("lets BYOK skip the demo quota and platform token caps", () => {
    expect(
      decidePlatformAccess({
        ...base,
        kind: "continue",
        hasByok: true,
        deviceGenerations: 9,
        platformTokensToday: 999_999,
        platformTokensMonth: 999_999,
        turnstileOk: false,
      }),
    ).toEqual({ ok: true, billing: "byok", mode: "gemini" });
  });

  it("refuses platform calls when the daily or monthly cap is exhausted", () => {
    const daily = decidePlatformAccess({ ...base, platformTokensToday: 50_000 });
    const monthly = decidePlatformAccess({
      ...base,
      platformTokensMonth: 300_000,
    });
    expect(daily.ok).toBe(false);
    expect(monthly.ok).toBe(false);
    if (!daily.ok) expect(daily.code).toBe("platform_budget");
    if (!monthly.ok) expect(monthly.replayAvailable).toBe(true);
  });

  it("requires turnstile only when the call would use platform keys", () => {
    const blocked = decidePlatformAccess({ ...base, turnstileOk: false });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("turnstile_required");

    expect(decidePlatformAccess({ ...base, providerMode: "mock", turnstileOk: false })).toEqual({
      ok: true,
      billing: "mock",
      mode: "mock",
    });
  });

  it("keeps mock and explicit replay off platform keys", () => {
    const mockDecision = decidePlatformAccess({
      ...base,
      providerMode: "mock",
      deviceGenerations: 4,
    });
    expect(mockDecision.ok && mockDecision.billing).toBe("mock");
    const replay = decidePlatformAccess({ ...base, useReplay: true, deviceGenerations: 4 });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.billing).toBe("replay");
      expect(replay.label).toBe("演示回放");
    }
  });
});
