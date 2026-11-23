import {
  createMockQaVerdicts,
  MOCK_ARCHITECT,
  MOCK_ENGINEER,
  MOCK_PLANNER,
} from "@/lib/agents/fixtures";
import type { LlmCompletion, LlmProvider } from "../types";

/** Deterministic fixture used by unit/e2e tests (REQ-5 / REQ-8). */
export const MOCK_COMPLETION_TEXT =
  "[mock] Atoms Studio — 固定演示输出：已根据提示生成可验证应用骨架。";

type MockCompleteInput = {
  stage?: "planner" | "architect" | "engineer" | "qa" | string;
  prompt?: string;
  acceptance?: string[];
  probe?: {
    compileErrors: string[];
    runtimeErrors: string[];
    blankScreen: boolean;
  };
};

export function createMockProvider(): LlmProvider {
  return {
    mode: "mock",
    async complete(input: unknown): Promise<LlmCompletion> {
      const stage =
        input && typeof input === "object" && "stage" in input
          ? (input as MockCompleteInput).stage
          : undefined;

      if (stage === "planner") {
        return {
          text: JSON.stringify(MOCK_PLANNER),
          meta: { mode: "mock" },
        };
      }
      if (stage === "architect") {
        return {
          text: JSON.stringify(MOCK_ARCHITECT),
          meta: { mode: "mock" },
        };
      }
      if (stage === "engineer") {
        const engineer = input as MockCompleteInput;
        const output = engineer.prompt?.includes("触发修复演示")
          ? {
              files: [{
                path: "src/App.tsx",
                content: "/* MOCK_COMPILE_ERROR */\nexport default function App() { return <main><h1>我的待办</h1>; }",
              }],
              summary: "演示初始编译错误。",
            }
          : MOCK_ENGINEER;
        return {
          text: JSON.stringify(output),
          meta: { mode: "mock" },
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
          meta: { mode: "mock" },
        };
      }
      if (stage === "qa") {
        const qaInput = input as MockCompleteInput;
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
          meta: { mode: "mock" },
        };
      }

      return {
        text: MOCK_COMPLETION_TEXT,
        meta: { mode: "mock" },
      };
    },
  };
}
