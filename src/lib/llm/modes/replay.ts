import {
  MOCK_ARCHITECT,
  MOCK_ENGINEER,
  MOCK_PLANNER,
} from "@/lib/agents/fixtures";
import type { LlmCompletion, LlmProvider } from "../types";

/** Pre-recorded demo run used as automatic fallback (REQ-5). */
export const REPLAY_COMPLETION_TEXT =
  "[replay] 这是预录的演示运行结果，用于在额度或上游故障时继续体验。";

export const REPLAY_LABEL = "演示回放" as const;

type ReplayCompleteInput = {
  stage?: "planner" | "architect" | "engineer" | string;
};

export function createReplayProvider(): LlmProvider {
  return {
    mode: "replay",
    async complete(input: unknown): Promise<LlmCompletion> {
      const stage =
        input && typeof input === "object" && "stage" in input
          ? (input as ReplayCompleteInput).stage
          : undefined;

      if (stage === "planner") {
        return {
          text: JSON.stringify(MOCK_PLANNER),
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
      if (stage === "architect") {
        return {
          text: JSON.stringify(MOCK_ARCHITECT),
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
      if (stage === "engineer") {
        return {
          text: JSON.stringify(MOCK_ENGINEER),
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }

      return {
        text: REPLAY_COMPLETION_TEXT,
        meta: { mode: "replay", label: REPLAY_LABEL },
      };
    },
  };
}
