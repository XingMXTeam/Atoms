/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiProvider } from "./gemini";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Gemini REST transport (REQ-5 / REQ-8)", () => {
  it("posts structured JSON schema with x-goog-api-key header per stage", async () => {
    vi.stubEnv("GEMINI_MODEL_FLASH", "gemini-2.5-flash");
    vi.stubEnv("GEMINI_MODEL_PRO", "gemini-2.5-pro");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const target = String(url);
        const text = target.includes("gemini-2.5-pro")
          ? JSON.stringify({
              files: [{ path: "src/App.tsx", content: "export default function App(){return null}" }],
              summary: "已生成应用",
            })
          : JSON.stringify({
              title: "测试应用",
              prd: "中文说明",
              acceptance: ["AC-1 正常渲染"],
            });
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

    const provider = createGeminiProvider({ apiKey: "test-key-123" });

    const planResult = await provider.complete({
      stage: "planner",
      modelClass: "flash",
      prompt: "做一个计算器",
    });
    expect(planResult.meta).toEqual({ mode: "gemini" });
    expect(JSON.parse(planResult.text).title).toBe("测试应用");

    const [plannerUrl, plannerInit] = fetchSpy.mock.calls[0] ?? [];
    expect(String(plannerUrl)).toContain("/models/gemini-2.5-flash:generateContent");
    expect(String(plannerUrl)).not.toContain("test-key-123");
    const plannerHeaders = plannerInit?.headers as Record<string, string>;
    expect(plannerHeaders["x-goog-api-key"]).toBe("test-key-123");
    const plannerBody = JSON.parse(String(plannerInit?.body));
    expect(plannerBody.generationConfig.responseMimeType).toBe("application/json");
    expect(plannerBody.generationConfig.responseSchema.required).toEqual([
      "title",
      "prd",
      "acceptance",
    ]);

    const engResult = await provider.complete({
      stage: "engineer",
      modelClass: "pro",
      prompt: "做一个计算器",
    });
    expect(engResult.meta).toEqual({ mode: "gemini" });
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      "/models/gemini-2.5-pro:generateContent",
    );
  });

  it("falls back to replay labelled 演示回放 on HTTP 429 or network error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("quota exceeded", { status: 429 }),
    );
    const provider = createGeminiProvider({ apiKey: "test-key-123" });

    const throttled = await provider.complete({
      stage: "planner",
      modelClass: "flash",
      prompt: "做一个待办",
    });
    expect(throttled.meta).toEqual({ mode: "replay", label: "演示回放" });
    expect(JSON.parse(throttled.text).title).toBeTruthy();

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNRESET"));
    const networkFail = await provider.complete({
      stage: "qa",
      modelClass: "flash",
      acceptance: ["AC-1 正常"],
      probe: { compileErrors: [], runtimeErrors: [], blankScreen: false },
    });
    expect(networkFail.meta).toEqual({ mode: "replay", label: "演示回放" });
    expect(JSON.parse(networkFail.text).verdicts).toHaveLength(1);
  });

  it("falls back from Pro 429 to Flash before replay", async () => {
    vi.stubEnv("GEMINI_MODEL_FLASH", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_MODEL_PRO", "gemini-3.1-pro-preview");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("pro quota", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        files: [{ path: "src/App.tsx", content: "export default function App(){return null}" }],
                        summary: "Flash fallback ok",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const provider = createGeminiProvider({ apiKey: "test-key-123" });
    const res = await provider.complete({
      stage: "engineer",
      modelClass: "pro",
      prompt: "做一个计数器",
    });

    expect(res.meta).toEqual({ mode: "gemini" });
    expect(JSON.parse(res.text).summary).toBe("Flash fallback ok");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("gemini-3.1-pro-preview");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("gemini-3.8-flash");
  });
});
