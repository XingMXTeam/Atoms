import {
  createMockQaVerdicts,
  MOCK_ARCHITECT,
  MOCK_PLANNER,
} from "@/lib/agents/fixtures";
import { SEED_EXAMPLE_PROJECTS } from "@/lib/db/seeds";
import type { LlmCompletion, LlmProvider } from "../types";

/** Pre-recorded demo run used as automatic fallback (REQ-5). */
export const REPLAY_COMPLETION_TEXT =
  "[replay] 这是预录的演示运行结果，用于在额度或上游故障时继续体验。";

export const REPLAY_LABEL = "演示回放" as const;

type ReplayCompleteInput = {
  stage?: "planner" | "architect" | "engineer" | "qa" | string;
  acceptance?: string[];
  probe?: {
    compileErrors: string[];
    runtimeErrors: string[];
    blankScreen: boolean;
  };
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
        const todoDemo = SEED_EXAMPLE_PROJECTS[0];
        return {
          text: JSON.stringify({
            files: todoDemo.files,
            summary: todoDemo.summary,
          }),
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
      if (stage === "engineer-repair") {
        return {
          text: JSON.stringify({
            files: [{
              path: "src/App.tsx",
              content: 'export default function App() { return <main><h1>我的待办</h1><p>预览已修复</p></main>; }',
            }],
            summary: "已根据 QA 指令修复预览。",
          }),
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
      if (stage === "qa") {
        const qaInput = input as ReplayCompleteInput;
        return {
          text: JSON.stringify(
            createMockQaVerdicts({
              acceptance: qaInput.acceptance ?? [],
              probe: qaInput.probe ?? {
                compileErrors: [],
                runtimeErrors: [],
                blankScreen: false,
              },
            }),
          ),
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
