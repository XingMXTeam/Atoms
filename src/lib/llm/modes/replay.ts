import type { LlmCompletion, LlmProvider } from "../types";

/** Pre-recorded demo run used as automatic fallback (REQ-5). */
export const REPLAY_COMPLETION_TEXT =
  "[replay] 这是预录的演示运行结果，用于在额度或上游故障时继续体验。";

export const REPLAY_LABEL = "演示回放" as const;

export function createReplayProvider(): LlmProvider {
  return {
    mode: "replay",
    async complete(_input: unknown): Promise<LlmCompletion> {
      return {
        text: REPLAY_COMPLETION_TEXT,
        meta: { mode: "replay", label: REPLAY_LABEL },
      };
    },
  };
}
