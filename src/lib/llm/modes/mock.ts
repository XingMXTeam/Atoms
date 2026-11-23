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

/** Prefix the user prompt with this phrase to exercise all three repair rounds. */
export const MOCK_PERSISTENT_FAILURE_TRIGGER = "持续失败演示";

/** Prefix the user prompt with this phrase to exercise a successful repair. */
export const MOCK_REPAIR_DEMO_TRIGGER = "触发修复演示";

const MOCK_REPAIR_ENTRY = {
  path: "src/main.tsx",
  content: `import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);`,
};

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
  let persistentRepairAttempt = 0;
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
        const output = engineer.prompt?.includes(MOCK_REPAIR_DEMO_TRIGGER) ||
          engineer.prompt?.includes(MOCK_PERSISTENT_FAILURE_TRIGGER)
          ? {
              files: [MOCK_REPAIR_ENTRY, {
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
        const repair = input as MockCompleteInput;
        const stillBroken = repair.prompt?.includes(MOCK_PERSISTENT_FAILURE_TRIGGER);
        if (stillBroken) persistentRepairAttempt += 1;
        return {
          text: JSON.stringify({
            files: [{
              path: "src/App.tsx",
              content: stillBroken
                ? `/* MOCK_COMPILE_ERROR */\n/* 持续失败修复 ${persistentRepairAttempt} */\nexport default function App() { return <main><h1>我的待办</h1>; }`
                : 'export default function App() { return <main><h1>我的待办</h1><p>预览已修复</p></main>; }',
            }],
            summary: stillBroken ? "演示修复后仍有编译错误。" : "已根据 QA 指令修复预览。",
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
