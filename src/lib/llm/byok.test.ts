/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseByokHeaders, BYOK_KEY_HEADER, BYOK_PROVIDER_HEADER } from "./byok";
import { createByokProvider } from "./provider";
import { selectStreamProvider } from "./run-provider";

const USER_KEY = "user-key-do-not-log-91af";
const PLATFORM_GEMINI = "platform-gemini-secret";
const PLATFORM_DEEPSEEK = "platform-deepseek-secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("BYOK provider isolation", () => {
  it("does not fall back to platform Gemini or DeepSeek when the visitor key fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", PLATFORM_GEMINI);
    vi.stubEnv("DEEPSEEK_API_KEY", PLATFORM_DEEPSEEK);
    vi.stubEnv("LLM_PROVIDER", "gemini");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const headerBlob = JSON.stringify(init?.headers ?? {});
      expect(url).not.toContain("generativelanguage.googleapis.com");
      expect(headerBlob).not.toContain(PLATFORM_GEMINI);
      expect(headerBlob).not.toContain(PLATFORM_DEEPSEEK);
      expect(url).toContain("https://example.test/v1/chat/completions");
      return new Response("unauthorized", { status: 401 });
    });

    const provider = createByokProvider({
      kind: "openai",
      apiKey: USER_KEY,
      baseUrl: "https://example.test/v1",
      model: "deepseek-chat",
    });

    await expect(
      provider.complete({ stage: "planner", prompt: "做一个待办" }),
    ).rejects.toThrow(/不会改用平台密钥/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const geminiFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string>;
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(headers["x-goog-api-key"]).toBe(USER_KEY);
      expect(headers["x-goog-api-key"]).not.toBe(PLATFORM_GEMINI);
      return new Response("nope", { status: 403 });
    });

    const gemini = createByokProvider({ kind: "gemini", apiKey: USER_KEY });
    await expect(
      gemini.complete({ stage: "planner", prompt: "做一个待办" }),
    ).rejects.toThrow(/不会改用平台密钥/);
    const urls = geminiFetch.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("api.deepseek.com"))).toBe(false);
    expect(urls.some((url) => url.includes(PLATFORM_GEMINI))).toBe(false);
  });

  it("rejects an incomplete key instead of treating the request as a platform demo", () => {
    const parsed = parseByokHeaders(
      new Headers({
        [BYOK_PROVIDER_HEADER]: "gemini",
        [BYOK_KEY_HEADER]: "short",
      }),
    );
    expect(parsed.attempted).toBe(true);
    expect(parsed.credentials).toBeNull();
    if (!parsed.credentials && parsed.attempted) {
      expect(parsed.errorZh).not.toContain("short");
    }
  });

  it("refuses a BYOK stream that omitted the key", () => {
    const choice = selectStreamProvider({
      billing: "byok",
      byok: { attempted: false, credentials: null },
      overPlatformBudget: false,
    });
    expect(choice.ok).toBe(false);
    if (!choice.ok) expect(choice.messageZh).toMatch(/平台密钥不会被用作备用/);
  });
});
