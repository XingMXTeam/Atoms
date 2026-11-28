import { publicByokFailureMessage } from "../byok";
import type { LlmCompletion, LlmProvider } from "../types";
import { fetchDeepSeekResult } from "./deepseek";
import type { GeminiCompleteInput } from "./prompts";

export type OpenAiCompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * Visitor-paid OpenAI-compatible chat completions (DeepSeek and similar).
 * Failures throw. This provider never reads platform Gemini or DeepSeek keys.
 */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
): LlmProvider {
  return {
    mode: "gemini",
    async complete(input: unknown): Promise<LlmCompletion> {
      const typed =
        input && typeof input === "object"
          ? (input as GeminiCompleteInput)
          : ({ prompt: String(input) } as GeminiCompleteInput);
      try {
        const result = await fetchDeepSeekResult(typed, {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        });
        return {
          text: result.text,
          meta: {
            mode: "gemini",
            ...(result.usage ? { usage: result.usage } : {}),
          },
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "fetch failed";
        throw new Error(publicByokFailureMessage(reason));
      }
    },
  };
}
