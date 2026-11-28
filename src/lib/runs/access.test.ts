/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { AppEnv } from "@/lib/env";
import { createSqliteRepository, sqliteContainsText } from "@/lib/db/adapters/sqlite";
import { runAgentPipeline } from "@/lib/agents/pipeline";
import { createLlmProvider } from "@/lib/llm/provider";
import { utcDay } from "@/lib/limits/rate-limit";
import { beginContinuation, beginInitialRun } from "./access";

const USER_KEY = "sk-user-secret-not-in-db-77c1";

function geminiEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    LLM_PROVIDER: "gemini",
    GEMINI_API_KEY: "platform-gemini",
    GEMINI_MODEL_FLASH: "gemini-test-flash",
    GEMINI_MODEL_PRO: "gemini-test-pro",
    DEEPSEEK_API_KEY: "platform-deepseek",
    DEEPSEEK_MODEL: "deepseek-chat",
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
    DEVICE_DAILY_RUN_LIMIT: 20,
    DAILY_TOKEN_CAP: 500_000,
    PLATFORM_DEMO_GENERATIONS: 1,
    PLATFORM_DAILY_TOKEN_CAP: 50_000,
    PLATFORM_MONTHLY_TOKEN_CAP: 300_000,
    TURNSTILE_SITE_KEY: "site-key",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    ...overrides,
  };
}

const turnstileOk = async () =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("platform demo and BYOK access", () => {
  it("allows one platform generation and refuses the next without a user key", async () => {
    const repo = createSqliteRepository(":memory:");
    const env = geminiEnv();
    const first = await beginInitialRun({
      repo,
      deviceId: "device-demo",
      prompt: "做一个待办清单",
      env,
      byok: { attempted: false, credentials: null },
      turnstileToken: "ok-token",
      fetchImpl: turnstileOk,
      day: "2026-11-28",
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.billing).toBe("platform");
    expect(await repo.getDevicePlatformGenerations("device-demo")).toBe(1);

    const second = await beginInitialRun({
      repo,
      deviceId: "device-demo",
      prompt: "再做一个笔记",
      env,
      byok: { attempted: false, credentials: null },
      turnstileToken: "ok-token",
      fetchImpl: turnstileOk,
      day: "2026-11-28",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("demo_exhausted");
      expect(second.replayAvailable).toBe(true);
    }
    expect(await repo.listProjects("device-demo")).toHaveLength(1);
    expect(await repo.getDevicePlatformGenerations("device-demo")).toBe(1);
  });

  it("refuses continue and follow-up on platform keys", async () => {
    const repo = createSqliteRepository(":memory:");
    const created = await beginInitialRun({
      repo,
      deviceId: "device-follow",
      prompt: "做一个习惯打卡",
      env: geminiEnv({ LLM_PROVIDER: "mock", TURNSTILE_SECRET_KEY: "" }),
      byok: { attempted: false, credentials: null },
      day: "2026-11-28",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const followUp = await beginContinuation({
      repo,
      deviceId: "device-follow",
      projectId: created.projectId,
      runId: created.runId,
      prompt: "加上统计",
      env: geminiEnv(),
      byok: { attempted: false, credentials: null },
      day: "2026-11-28",
    });
    expect(followUp.ok).toBe(false);
    if (!followUp.ok) {
      expect(followUp.code).toBe("byok_required");
      expect(followUp.replayAvailable).toBe(false);
    }

    const resume = await beginContinuation({
      repo,
      deviceId: "device-follow",
      projectId: created.projectId,
      runId: created.runId,
      env: geminiEnv(),
      byok: { attempted: false, credentials: null },
    });
    expect(resume.ok).toBe(false);

    const mocked = await beginContinuation({
      repo,
      deviceId: "device-follow",
      projectId: created.projectId,
      runId: created.runId,
      prompt: "本地继续",
      env: geminiEnv({ LLM_PROVIDER: "mock" }),
      byok: { attempted: false, credentials: null },
    });
    expect(mocked.ok).toBe(true);
    if (mocked.ok) expect(mocked.billing).toBe("mock");
  });

  it("does not charge the platform token budget for BYOK and does not store the key", async () => {
    const repo = createSqliteRepository(":memory:");
    const day = utcDay();
    const started = await beginInitialRun({
      repo,
      deviceId: "device-byok",
      prompt: "做一个菜谱",
      env: geminiEnv(),
      byok: {
        attempted: true,
        credentials: { kind: "gemini", apiKey: USER_KEY },
      },
      day,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.billing).toBe("byok");
    expect(await repo.getDevicePlatformGenerations("device-byok")).toBe(0);
    expect(await repo.getGlobalPlatformTokens(day)).toBe(0);
    expect(sqliteContainsText(repo, USER_KEY)).toBe(false);
    expect(sqliteContainsText(repo, "platform-gemini")).toBe(false);

    const run = await repo.getRun(started.runId);
    expect(run?.billing).toBe("byok");

    await runAgentPipeline({
      repo,
      provider: {
        mode: "mock",
        async complete(input) {
          const base = await createLlmProvider({ mode: "mock" }).complete(input);
          return {
            ...base,
            meta: { ...base.meta, usage: { tokensIn: 80, tokensOut: 20 } },
          };
        },
      },
      projectId: started.projectId,
      runId: started.runId,
      deviceId: "device-byok",
      prompt: "做一个菜谱",
      billTo: "visitor",
    });

    expect(await repo.getGlobalPlatformTokens(day)).toBe(0);
    expect(await repo.getMonthlyPlatformTokens("2026-11")).toBe(0);
    const usage = await repo.getUsage("device-byok", day);
    expect(usage?.platformTokens ?? 0).toBe(0);
    expect(sqliteContainsText(repo, USER_KEY)).toBe(false);

    const platformProject = await repo.createProject({
      deviceId: "device-byok",
      title: "平台计量",
    });
    const platformRun = await repo.createRun({
      projectId: platformProject.id,
      status: "running",
      billing: "platform",
    });
    await runAgentPipeline({
      repo,
      provider: {
        mode: "mock",
        async complete(input) {
          const base = await createLlmProvider({ mode: "mock" }).complete(input);
          return {
            ...base,
            meta: { ...base.meta, usage: { tokensIn: 10, tokensOut: 5 } },
          };
        },
      },
      projectId: platformProject.id,
      runId: platformRun.id,
      deviceId: "device-byok",
      prompt: "计量",
      billTo: "platform",
    });
    expect(await repo.getGlobalPlatformTokens(day)).toBeGreaterThan(0);
  });

  it("does not start a platform run when turnstile is not configured", async () => {
    const repo = createSqliteRepository(":memory:");
    let called = false;
    const result = await beginInitialRun({
      repo,
      deviceId: "device-turnstile",
      prompt: "做一个记账本",
      env: geminiEnv({ TURNSTILE_SECRET_KEY: "" }),
      byok: { attempted: false, credentials: null },
      turnstileToken: "ignored",
      fetchImpl: async () => {
        called = true;
        return new Response("nope", { status: 500 });
      },
      day: "2026-11-28",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("turnstile_required");
    expect(called).toBe(false);
    expect(await repo.getDevicePlatformGenerations("device-turnstile")).toBe(0);
    expect(await repo.listProjects("device-turnstile")).toHaveLength(0);
  });

  it("stops platform demos when the global platform token cap is already spent", async () => {
    const repo = createSqliteRepository(":memory:");
    await repo.incrementUsage("someone-else", "2026-11-28", {
      platformTokens: 50_000,
    });
    const result = await beginInitialRun({
      repo,
      deviceId: "device-cap",
      prompt: "做一个看板",
      env: geminiEnv(),
      byok: { attempted: false, credentials: null },
      turnstileToken: "ok-token",
      fetchImpl: turnstileOk,
      day: "2026-11-28",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("platform_budget");
    expect(await repo.getDevicePlatformGenerations("device-cap")).toBe(0);
  });
});
