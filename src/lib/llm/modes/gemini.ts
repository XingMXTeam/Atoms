import { resolveModelId, type ModelClass } from "../model-routing";
import type { LlmCompletion, LlmProvider, TokenUsage } from "../types";
import { fetchDeepSeekResult, type DeepSeekConfig } from "./deepseek";
import {
  buildPromptForStage,
  stripJsonFence,
  type GeminiCompleteInput,
} from "./prompts";
import { createReplayProvider, REPLAY_LABEL } from "./replay";

export {
  buildPromptForStage,
  stripJsonFence,
  type GeminiCompleteInput,
} from "./prompts";

export type GeminiProviderOptions = {
  apiKey?: string;
  /** Optional DeepSeek API key used as live secondary fallback when Gemini is unavailable. */
  deepseekApiKey?: string;
  deepseekModel?: string;
  deepseekBaseUrl?: string;
  /** Optional transport hook for streaming / unit tests. */
  fetchCompletion?: (
    input: GeminiCompleteInput & { modelId: string },
    apiKey: string,
  ) => Promise<string>;
  /** Optional DeepSeek transport hook for unit tests. */
  fetchDeepSeek?: (
    input: GeminiCompleteInput,
    config: DeepSeekConfig,
  ) => Promise<{ text: string; usage?: TokenUsage }>;
};

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 45_000;
const FLASH_TRANSIENT_RETRY_DELAY_MS = 1_000;

function isGeminiAccountOrAuthFailure(message: string): boolean {
  return (
    message.includes("Gemini HTTP 401") ||
    message.includes("Gemini HTTP 402") ||
    message.includes("Gemini HTTP 403")
  );
}

type GeminiSchemaNode = {
  type: "OBJECT" | "ARRAY" | "STRING" | "BOOLEAN" | "INTEGER" | "NUMBER";
  properties?: Record<string, GeminiSchemaNode>;
  required?: string[];
  items?: GeminiSchemaNode;
  enum?: string[];
};

function responseSchemaForStage(stage?: string): GeminiSchemaNode | undefined {
  switch (stage) {
    case "planner":
      return {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          prd: { type: "STRING" },
          acceptance: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "prd", "acceptance"],
      };
    case "architect":
      return {
        type: "OBJECT",
        properties: {
          files: { type: "ARRAY", items: { type: "STRING" } },
          components: { type: "ARRAY", items: { type: "STRING" } },
          data: { type: "ARRAY", items: { type: "STRING" } },
          notes: { type: "STRING" },
        },
        required: ["files", "components", "data", "notes"],
      };
    case "engineer":
    case "engineer-repair":
      return {
        type: "OBJECT",
        properties: {
          files: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                path: { type: "STRING" },
                content: { type: "STRING" },
              },
              required: ["path", "content"],
            },
          },
          summary: { type: "STRING" },
        },
        required: ["files", "summary"],
      };
    case "qa":
    case "qa-review-judge":
      return {
        type: "OBJECT",
        properties: {
          verdicts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                criterion: { type: "STRING" },
                verdict: { type: "STRING", enum: ["pass", "fail", "unverified"] },
                reason: { type: "STRING" },
              },
              required: ["criterion", "verdict", "reason"],
            },
          },
          fixInstruction: { type: "STRING" },
        },
        required: ["verdicts"],
      };
    case "qa-review-plan":
      return {
        type: "OBJECT",
        properties: {
          cases: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                criterion: { type: "STRING" },
                strategy: { type: "STRING", enum: ["playwright", "vitest", "hybrid"] },
                steps: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING", enum: ["press", "click", "fill", "wait", "reload", "assert"] },
                      key: { type: "STRING" },
                      count: { type: "INTEGER" },
                      text: { type: "STRING" },
                      role: { type: "STRING", enum: ["button", "checkbox", "link", "tab"] },
                      selector: { type: "STRING" },
                      label: { type: "STRING" },
                      placeholder: { type: "STRING" },
                      ms: { type: "INTEGER" },
                      expectText: { type: "STRING" },
                      expectTextChanged: { type: "BOOLEAN" },
                      expectStorageChanged: { type: "BOOLEAN" },
                      expectNoErrors: { type: "BOOLEAN" },
                      expectVisible: { type: "STRING" },
                    },
                    required: ["type"],
                  },
                },
                vitestCode: { type: "STRING" },
                expectDescription: { type: "STRING" },
              },
              required: ["criterion", "strategy", "expectDescription"],
            },
          },
        },
        required: ["cases"],
      };
    default:
      return undefined;
  }
}

async function defaultFetchGeminiResult(
  input: GeminiCompleteInput & { modelId: string },
  apiKey: string,
): Promise<{ text: string; usage?: TokenUsage }> {
  const { systemInstruction, userPrompt } = buildPromptForStage(input);
  const schema = responseSchemaForStage(input.stage);

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature:
        input.stage === "qa" ||
        input.stage === "qa-review-plan" ||
        input.stage === "qa-review-judge"
          ? 0.1
          : 0.3,
      ...(input.modelId.startsWith("gemini-3")
        ? { thinkingConfig: { thinkingLevel: "low" } }
        : {}),
      ...(schema
        ? {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        : {}),
    },
  };

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(input.modelId)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`Gemini HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    const rawText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!rawText) {
      throw new Error("Gemini returned an empty completion");
    }

    const um = payload.usageMetadata;
    let usage: TokenUsage | undefined;
    if (um && typeof um === "object") {
      const tokensIn =
        typeof um.promptTokenCount === "number" ? um.promptTokenCount : 0;
      const tokensOut =
        typeof um.candidatesTokenCount === "number"
          ? um.candidatesTokenCount
          : Math.max(0, (typeof um.totalTokenCount === "number" ? um.totalTokenCount : 0) - tokensIn);
      if (tokensIn + tokensOut > 0) {
        usage = { tokensIn, tokensOut };
      }
    }

    return { text: schema ? stripJsonFence(rawText) : rawText, usage };
  } finally {
    clearTimeout(timer);
  }
}

export async function defaultFetchGeminiCompletion(
  input: GeminiCompleteInput & { modelId: string },
  apiKey: string,
): Promise<string> {
  const { text } = await defaultFetchGeminiResult(input, apiKey);
  return text;
}

/**
 * Gemini REST provider with automatic DeepSeek secondary live fallback.
 * Uses Flash for Planner/Architect/QA and Pro-tier Flash for Engineer (REQ-8).
 * Missing key or transport failure → DeepSeek (when configured) → replay + 「演示回放」 (REQ-5).
 */
export function createGeminiProvider(
  options: GeminiProviderOptions = {},
): LlmProvider {
  const replay = createReplayProvider();
  const customTransport = options.fetchCompletion;
  const runGemini = async (
    args: GeminiCompleteInput & { modelId: string },
    apiKey: string,
  ): Promise<{ text: string; usage?: TokenUsage }> => {
    if (customTransport) {
      return { text: await customTransport(args, apiKey) };
    }
    return defaultFetchGeminiResult(args, apiKey);
  };

  const deepseekKey = options.deepseekApiKey?.trim() ?? "";
  const runDeepSeek =
    options.fetchDeepSeek ??
    ((args: GeminiCompleteInput, cfg: DeepSeekConfig) =>
      fetchDeepSeekResult(args, cfg));

  // Avoid repeating doomed Gemini requests across stages once 401/402/403 is observed.
  let skipGeminiForRun = false;

  const fallbackOrThrowFollowUp = async (
    input: unknown,
    isFollowUp: boolean,
  ): Promise<LlmCompletion> => {
    if (isFollowUp) {
      throw new Error("上游模型暂时不可用，已保留当前版本，请稍后重试");
    }
    const fallback = await replay.complete(input);
    return {
      text: fallback.text,
      meta: { mode: "replay", label: REPLAY_LABEL },
    };
  };

  const tryDeepSeekFallback = async (
    typed: GeminiCompleteInput,
    geminiReason: string,
  ): Promise<LlmCompletion | null> => {
    if (!deepseekKey) return null;
    try {
      const dsResult = await runDeepSeek(typed, {
        apiKey: deepseekKey,
        model: options.deepseekModel,
        baseUrl: options.deepseekBaseUrl,
      });
      console.warn("[llm-fallback]", {
        stage: typed.stage ?? "general",
        to: "deepseek",
        reason: geminiReason,
      });
      return {
        text: dsResult.text,
        meta: {
          mode: "gemini",
          ...(dsResult.usage ? { usage: dsResult.usage } : {}),
        },
      };
    } catch (dsError) {
      console.warn("[llm-fallback]", {
        stage: typed.stage ?? "general",
        to: "replay",
        geminiReason,
        deepseekReason:
          dsError instanceof Error ? dsError.message : String(dsError),
      });
      return null;
    }
  };

  return {
    mode: "gemini",
    async complete(input: unknown): Promise<LlmCompletion> {
      const typed =
        input && typeof input === "object"
          ? (input as GeminiCompleteInput)
          : ({ prompt: String(input) } as GeminiCompleteInput);

      const isFollowUp =
        Array.isArray(typed.currentFiles) && typed.currentFiles.length > 0;
      const modelClass: ModelClass =
        typed.modelClass === "pro" ? "pro" : "flash";
      const modelId = resolveModelId(modelClass);
      const flashModelId = resolveModelId("flash");

      const apiKey = options.apiKey?.trim() ?? "";
      if (!apiKey || skipGeminiForRun) {
        const reason = !apiKey
          ? "missing_api_key"
          : "gemini_account_short_circuit";
        const dsCompletion = await tryDeepSeekFallback(typed, reason);
        if (dsCompletion) return dsCompletion;
        console.warn("[gemini-fallback]", {
          stage: typed.stage ?? "general",
          modelId,
          hasKey: Boolean(apiKey),
          reason,
        });
        return fallbackOrThrowFollowUp(input, isFollowUp);
      }

      try {
        const result = await runGemini({ ...typed, modelClass, modelId }, apiKey);
        return {
          text: result.text,
          meta: { mode: "gemini", ...(result.usage ? { usage: result.usage } : {}) },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isGeminiAccountOrAuthFailure(message)) {
          skipGeminiForRun = true;
        } else {
          const canFallbackToFlash =
            modelId !== flashModelId &&
            (message.includes("Gemini HTTP 404") ||
              message.includes("Gemini HTTP 429") ||
              message.includes("Gemini HTTP 503") ||
              message.includes("aborted"));
          const canRetryTransientFlash =
            modelId === flashModelId &&
            (message.includes("Gemini HTTP 503") ||
              message.includes("Gemini HTTP 429"));

          if (canFallbackToFlash || canRetryTransientFlash) {
            if (canRetryTransientFlash) {
              await new Promise((resolve) =>
                setTimeout(resolve, FLASH_TRANSIENT_RETRY_DELAY_MS),
              );
            }
            try {
              const result = await runGemini(
                { ...typed, modelClass: "flash", modelId: flashModelId },
                apiKey,
              );
              return {
                text: result.text,
                meta: {
                  mode: "gemini",
                  ...(result.usage ? { usage: result.usage } : {}),
                },
              };
            } catch (retryError) {
              const retryMessage =
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError);
              if (isGeminiAccountOrAuthFailure(retryMessage)) {
                skipGeminiForRun = true;
              }
              const dsCompletion = await tryDeepSeekFallback(
                typed,
                retryMessage,
              );
              if (dsCompletion) return dsCompletion;
              console.warn("[gemini-fallback]", {
                stage: typed.stage ?? "general",
                modelId: flashModelId,
                hasKey: true,
                reason: retryMessage,
              });
              return fallbackOrThrowFollowUp(input, isFollowUp);
            }
          }
        }

        const dsCompletion = await tryDeepSeekFallback(typed, message);
        if (dsCompletion) return dsCompletion;

        console.warn("[gemini-fallback]", {
          stage: typed.stage ?? "general",
          modelId,
          hasKey: true,
          reason: message,
        });
        return fallbackOrThrowFollowUp(input, isFollowUp);
      }
    },
  };
}
