import type { LlmCompletion, LlmProvider } from "../types";
import { createReplayProvider, REPLAY_LABEL } from "./replay";

export type GeminiProviderOptions = {
  apiKey?: string;
  /** Optional transport hook for later streaming wiring / tests. */
  fetchCompletion?: (input: unknown, apiKey: string) => Promise<string>;
};

/**
 * Gemini REST provider shell for F1.
 * Missing key / transport failure → auto-fallback to replay + 「演示回放」.
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

      try {
        if (!options.fetchCompletion) {
          // Live streaming is wired in generate-loop; F1 proves the shell.
          throw new Error("gemini transport not configured");
        }
        const text = await options.fetchCompletion(input, apiKey);
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
