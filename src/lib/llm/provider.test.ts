/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("LLM provider (REQ-5)", () => {
  it("mock.complete returns a deterministic fixed payload", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    const { createLlmProvider } = await import("./provider");
    const provider = createLlmProvider();

    expect(provider.mode).toBe("mock");

    const first = await provider.complete({ prompt: "hello" });
    const second = await provider.complete({ prompt: "different" });

    expect(first.text).toBeTruthy();
    expect(first.meta.mode).toBe("mock");
    expect(first.meta.label).toBeUndefined();
    expect(second).toEqual(first);
  });

  it("selects provider mode from LLM_PROVIDER env", async () => {
    vi.stubEnv("LLM_PROVIDER", "replay");
    const { createLlmProvider } = await import("./provider");
    const provider = createLlmProvider();

    expect(provider.mode).toBe("replay");
    const result = await provider.complete({ prompt: "x" });
    expect(result.meta.mode).toBe("replay");
    expect(result.meta.label).toBe("演示回放");
  });

  it("gemini mode falls back to replay with 演示回放 when key is missing", async () => {
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    const { createLlmProvider } = await import("./provider");
    const provider = createLlmProvider();

    expect(provider.mode).toBe("gemini");
    const result = await provider.complete({ prompt: "build an app" });
    expect(result.meta.mode).toBe("replay");
    expect(result.meta.label).toBe("演示回放");
    expect(result.text).toBeTruthy();
  });
});
