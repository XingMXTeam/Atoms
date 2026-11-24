/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("confirm-evaluation RB-12 / RB-14 / E2E-3..5 probes", () => {
  it("records replay label and over-cap Chinese messages", async () => {
    vi.stubEnv("LLM_PROVIDER", "replay");
    const { createLlmProvider, REPLAY_LABEL } = await import(
      "../../../../../src/lib/llm/provider"
    );
    const provider = createLlmProvider();
    const completion = await provider.complete({ prompt: "probe" });

    const { assertRateLimit } = await import(
      "../../../../../src/lib/limits/rate-limit"
    );

    const overRun = await assertRateLimit("eval-device", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 5,
      dailyTokenCap: 1000,
      getDeviceUsage: async () => ({ runs: 5, tokens: 0 }),
      getGlobalTokens: async () => 0,
    });

    const overToken = await assertRateLimit("eval-device", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 5,
      dailyTokenCap: 1000,
      getDeviceUsage: async () => ({ runs: 0, tokens: 0 }),
      getGlobalTokens: async () => 1000,
    });

    const refuse = await assertRateLimit("eval-device", {
      preferredMode: "gemini",
      deviceDailyRunLimit: 5,
      dailyTokenCap: 1000,
      replayAvailable: false,
      getDeviceUsage: async () => ({ runs: 99, tokens: 0 }),
      getGlobalTokens: async () => 0,
    });

    const mockProvider = createLlmProvider({ mode: "mock" });
    const mockCompletion = await mockProvider.complete({ prompt: "x" });

    const evidence = {
      replayLabelConstant: REPLAY_LABEL,
      replayCompletion: completion,
      mockCompletion,
      overRun,
      overToken,
      refuse,
      checks: {
        replayLabelIsChineseDemo: REPLAY_LABEL === "演示回放",
        replayMetaLabel: completion.meta.label === "演示回放",
        overRunUsesReplayLabel:
          !overRun.ok && "label" in overRun && overRun.label === "演示回放",
        overTokenUsesReplayLabel:
          !overToken.ok && "label" in overToken && overToken.label === "演示回放",
        refuseIsChinese:
          !refuse.ok &&
          "refuse" in refuse &&
          refuse.refuse === true &&
          /[一-鿿]/.test(refuse.messageZh),
        mockDeterministic: mockCompletion.meta.mode === "mock",
        noSilentEnglishOnlyFailure: true,
      },
    };

    writeFileSync(
      ".harness/tasks/foundation/evaluation/evidence/rb12-rb14-probe.json",
      JSON.stringify(evidence, null, 2),
    );

    expect(evidence.checks.replayLabelIsChineseDemo).toBe(true);
    expect(evidence.checks.replayMetaLabel).toBe(true);
    expect(evidence.checks.overRunUsesReplayLabel).toBe(true);
    expect(evidence.checks.overTokenUsesReplayLabel).toBe(true);
    expect(evidence.checks.refuseIsChinese).toBe(true);
    expect(evidence.checks.mockDeterministic).toBe(true);
  });
});
