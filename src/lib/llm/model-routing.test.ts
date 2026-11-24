/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("LLM model routing (REQ-8)", () => {
  it("exposes Flash and Pro model ids from env with defaults", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("GEMINI_MODEL_FLASH", "gemini-flash-test");
    vi.stubEnv("GEMINI_MODEL_PRO", "gemini-pro-test");
    const { getEnv } = await import("@/lib/env");
    const env = getEnv();
    expect(env.GEMINI_MODEL_FLASH).toBe("gemini-flash-test");
    expect(env.GEMINI_MODEL_PRO).toBe("gemini-pro-test");
  });

  it("resolveModelId maps flash/pro class to configured ids", async () => {
    vi.stubEnv("GEMINI_MODEL_FLASH", "flash-id");
    vi.stubEnv("GEMINI_MODEL_PRO", "pro-id");
    const { resolveModelId } = await import("./model-routing");
    expect(resolveModelId("flash")).toBe("flash-id");
    expect(resolveModelId("pro")).toBe("pro-id");
  });

  it("mock provider returns stage-specific structured JSON fixtures", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    const { createLlmProvider } = await import("./provider");
    const provider = createLlmProvider({ mode: "mock" });

    const planner = await provider.complete({
      prompt: "做一个待办清单",
      stage: "planner",
      modelClass: "flash",
    });
    const plan = JSON.parse(planner.text) as {
      title: string;
      acceptance: string[];
    };
    expect(plan.title).toBeTruthy();
    expect(plan.acceptance.length).toBeGreaterThan(0);
    expect(plan.acceptance[0]?.startsWith("AC-")).toBe(true);

    const architect = await provider.complete({
      prompt: "做一个待办清单",
      stage: "architect",
      modelClass: "flash",
    });
    const design = JSON.parse(architect.text) as {
      files: string[];
      components: string[];
    };
    expect(design.files.length).toBeGreaterThan(0);
    expect(design.components.length).toBeGreaterThan(0);

    const engineer = await provider.complete({
      prompt: "做一个待办清单",
      stage: "engineer",
      modelClass: "pro",
    });
    const filesPayload = JSON.parse(engineer.text) as {
      files: Array<{ path: string; content: string }>;
      summary: string;
    };
    expect(filesPayload.files.length).toBeGreaterThan(1);
    expect(filesPayload.files.some((f) => f.path.endsWith(".tsx"))).toBe(true);
    expect(filesPayload.summary).toBeTruthy();
  });
});
