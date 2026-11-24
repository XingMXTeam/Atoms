/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDeepSeekResult } from "./deepseek";
import { buildPromptForStage, createGeminiProvider } from "./gemini";

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
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 429 }))
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 429 }));
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

  it("refuses replay fallback on follow-up runs so currentVersion files cannot be overwritten", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("pro overload", { status: 503 }))
      .mockResolvedValueOnce(new Response("flash overload", { status: 503 }));

    const provider = createGeminiProvider({ apiKey: "test-key-123" });
    await expect(
      provider.complete({
        stage: "engineer",
        modelClass: "pro",
        prompt: "修复添加按钮没反应",
        currentFiles: [{ path: "src/App.tsx", content: "export default () => <div>v2</div>" }],
      }),
    ).rejects.toThrow(/保留当前版本/);
  });

  it("includes conversation history and existing file context across follow-up prompts", () => {
    const history = [
      { role: "user" as const, content: "做一个待办" },
      { role: "agent" as const, content: "已升级渐变卡片 UI" },
      { role: "user" as const, content: "点击添加没反应" },
    ];
    const currentFiles = [
      { path: "src/main.tsx", content: "// main" },
      { path: "src/App.tsx", content: "// styled v2" },
    ];

    const planPrompt = buildPromptForStage({
      stage: "planner",
      prompt: "点击添加没反应",
      history,
      currentFiles,
    });
    expect(planPrompt.userPrompt).toContain("已升级渐变卡片 UI");
    expect(planPrompt.userPrompt).toContain("src/App.tsx");

    const archPrompt = buildPromptForStage({
      stage: "architect",
      prompt: "点击添加没反应",
      history,
      currentFiles,
    });
    expect(archPrompt.systemInstruction).toContain("沿用并保留现有文件结构");
    expect(archPrompt.userPrompt).toContain("src/App.tsx");

    const engPrompt = buildPromptForStage({
      stage: "engineer",
      prompt: "点击添加没反应",
      history,
      currentFiles,
    });
    expect(engPrompt.systemInstruction).toContain("禁止推倒重写");
    expect(engPrompt.userPrompt).toContain("// styled v2");
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

  it("parses Gemini usageMetadata into meta.usage tokensIn/tokensOut", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "计费测试",
                      prd: "prd",
                      acceptance: ["AC-1"],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 45,
            totalTokenCount: 165,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const provider = createGeminiProvider({ apiKey: "test-key-123" });
    const res = await provider.complete({
      stage: "planner",
      modelClass: "flash",
      prompt: "做一个待办",
    });

    expect(res.meta).toEqual({
      mode: "gemini",
      usage: { tokensIn: 120, tokensOut: 45 },
    });
  });

  it("falls back to DeepSeek on Gemini 402, short-circuits same-run stages, and preserves follow-ups", async () => {
    const geminiMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Gemini HTTP 402: quota depleted"));
    const deepseekMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({ title: "待办", prd: "prd", acceptance: ["AC-1"] }),
        usage: { tokensIn: 40, tokensOut: 25 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          files: [{ path: "src/App.tsx", content: "export default function App(){return <div/>}" }],
          summary: "follow-up ok",
        }),
        usage: { tokensIn: 90, tokensOut: 60 },
      });

    const provider = createGeminiProvider({
      apiKey: "gem-test-key",
      deepseekApiKey: "ds-test-key",
      fetchCompletion: geminiMock,
      fetchDeepSeek: deepseekMock,
    });

    const first = await provider.complete({
      stage: "planner",
      modelClass: "flash",
      prompt: "做一个待办应用",
    });
    expect(first.meta).toEqual({
      mode: "gemini",
      usage: { tokensIn: 40, tokensOut: 25 },
    });
    expect(geminiMock).toHaveBeenCalledTimes(1);

    // Next stage & follow-up on same run short-circuit Gemini directly to DeepSeek.
    const followUp = await provider.complete({
      stage: "engineer",
      modelClass: "pro",
      prompt: "优化UI",
      currentFiles: [{ path: "src/App.tsx", content: "// existing" }],
    });
    expect(followUp.meta).toEqual({
      mode: "gemini",
      usage: { tokensIn: 90, tokensOut: 60 },
    });
    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(deepseekMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to styled replay (initial) or throws (follow-up) when both Gemini and DeepSeek fail", async () => {
    const provider = createGeminiProvider({
      apiKey: "",
      deepseekApiKey: "ds-test-key",
      fetchDeepSeek: vi.fn().mockRejectedValue(new Error("DeepSeek HTTP 503")),
    });

    const initial = await provider.complete({
      stage: "engineer",
      modelClass: "pro",
      prompt: "做一个待办",
    });
    expect(initial.meta).toEqual({ mode: "replay", label: "演示回放" });
    const parsed = JSON.parse(initial.text) as {
      files: Array<{ path: string; content: string }>;
    };
    expect(
      parsed.files.some((f) => f.content.includes("我的待办")),
    ).toBe(true);

    await expect(
      provider.complete({
        stage: "engineer",
        modelClass: "pro",
        prompt: "修改按钮",
        currentFiles: [{ path: "src/App.tsx", content: "// existing" }],
      }),
    ).rejects.toThrow("保留当前版本");
  });

  it("fetchDeepSeekResult sends bearer auth, json_object format, stage contract, and maps usage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '```json\n{"verdicts":[{"criterion":"AC-1 登录页展示","verdict":"pass","reason":"ok"}]}\n```',
              },
            },
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 32,
            total_tokens: 182,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await fetchDeepSeekResult(
      {
        stage: "qa",
        acceptance: ["AC-1 登录页展示"],
        probe: { compileErrors: [], runtimeErrors: [], blankScreen: false },
      },
      { apiKey: "ds-secret", model: "deepseek-chat" },
    );

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.deepseek.com/chat/completions");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ds-secret");
    const parsedBody = JSON.parse(String(init?.body));
    expect(parsedBody.response_format).toEqual({ type: "json_object" });
    expect(parsedBody.messages[0].content).toContain("逐条包含且仅包含输入 acceptance");
    expect(JSON.parse(res.text).verdicts[0].criterion).toBe("AC-1 登录页展示");
    expect(res.usage).toEqual({ tokensIn: 150, tokensOut: 32 });
  });
});
