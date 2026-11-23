import type { LlmCompletion, LlmProvider } from "../types";

/** Deterministic fixture used by unit/e2e tests (REQ-5). */
export const MOCK_COMPLETION_TEXT =
  "[mock] Atoms Studio — 固定演示输出：已根据提示生成可验证应用骨架。";

export function createMockProvider(): LlmProvider {
  return {
    mode: "mock",
    async complete(_input: unknown): Promise<LlmCompletion> {
      return {
        text: MOCK_COMPLETION_TEXT,
        meta: { mode: "mock" },
      };
    },
  };
}
