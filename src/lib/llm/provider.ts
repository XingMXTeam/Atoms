import { getEnv, type ProviderMode } from "@/lib/env";
import { createGeminiProvider } from "./modes/gemini";
import { createMockProvider } from "./modes/mock";
import { createReplayProvider } from "./modes/replay";
import type { LlmProvider } from "./types";

export type { LlmCompletion, LlmProvider, ProviderMode } from "./types";
export { REPLAY_LABEL } from "./modes/replay";
export { MOCK_COMPLETION_TEXT } from "./modes/mock";

export type CreateLlmProviderOptions = {
  mode?: ProviderMode;
  geminiApiKey?: string;
};

/** Factory: `LLM_PROVIDER` selects gemini | mock | replay (REQ-5). */
export function createLlmProvider(
  options: CreateLlmProviderOptions = {},
): LlmProvider {
  const env = getEnv();
  const mode = options.mode ?? env.LLM_PROVIDER;

  switch (mode) {
    case "mock":
      return createMockProvider();
    case "replay":
      return createReplayProvider();
    case "gemini":
      return createGeminiProvider({
        apiKey: options.geminiApiKey ?? env.GEMINI_API_KEY,
      });
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
