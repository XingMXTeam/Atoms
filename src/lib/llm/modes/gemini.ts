import { resolveModelId, type ModelClass } from "../model-routing";
import type { LlmCompletion, LlmProvider } from "../types";
import { createReplayProvider, REPLAY_LABEL } from "./replay";

export type GeminiProviderOptions = {
  apiKey?: string;
  /** Optional transport hook for later streaming wiring / tests. */
  fetchCompletion?: (input: GeminiCompleteInput, apiKey: string) => Promise<string>;
};

export type GeminiCompleteInput = {
  prompt?: string;
  stage?: string;
  modelClass?: ModelClass;
  responseSchema?: unknown;
  [key: string]: unknown;
};

/**
 * Gemini REST provider shell.
 * Missing key / transport failure → auto-fallback to replay + 「演示回放」.
 * Live streamGenerateContent wiring uses modelClass → Flash/Pro ids (REQ-8).
 */
export function createGeminiProvider(
  options: GeminiProviderOptions = {},
): LlmProvider {
  const replay = createReplayProvider();

  return {
    mode: "gemini",
    async complete(input: unknown): Promise<LlmCompletion> {
      const apiKey = options.apiKey ?? "";
      if (!apiKey) {
        const fallback = await replay.complete(input);
        return {
          text: fallback.text,
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }

      const typed =
        input && typeof input === "object"
          ? (input as GeminiCompleteInput)
          : ({ prompt: String(input) } as GeminiCompleteInput);

      const modelClass: ModelClass =
        typed.modelClass === "pro" ? "pro" : "flash";
      const modelId = resolveModelId(modelClass);

      try {
        if (!options.fetchCompletion) {
          // Live streaming is exercised via SSE route; shell proves routing.
          throw new Error(
            `gemini transport not configured (model=${modelId}, stage=${typed.stage ?? "n/a"})`,
          );
        }
        const text = await options.fetchCompletion(
          { ...typed, modelClass, modelId },
          apiKey,
        );
        return { text, meta: { mode: "gemini" } };
      } catch {
        const fallback = await replay.complete(input);
        return {
          text: fallback.text,
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
    },
  };
}
