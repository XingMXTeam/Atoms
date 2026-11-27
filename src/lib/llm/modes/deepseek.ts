import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
} from "@/lib/env";
import type { TokenUsage } from "../types";
import {
  buildPromptForStage,
  stripJsonFence,
  type GeminiCompleteInput,
} from "./prompts";

const DEEPSEEK_TIMEOUT_DEFAULT_MS = 30_000;
const DEEPSEEK_TIMEOUT_ENGINEER_MS = 60_000;

export type DeepSeekConfig = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

function jsonContractForStage(stage?: string): string | undefined {
  switch (stage) {
    case "planner":
      return '请严格只输出单个合法 JSON 对象（不要使用 Markdown 代码块），必须包含字段：{"title":"简短中文标题","prd":"中文 PRD","acceptance":["AC-1 ...","AC-2 ...","AC-3 ..."]}。';
    case "architect":
      return '请严格只输出单个合法 JSON 对象（不要使用 Markdown 代码块），必须包含字段：{"files":["src/main.tsx","src/App.tsx"],"components":["App"],"data":["状态说明"],"notes":"架构说明"}。';
    case "engineer":
    case "engineer-repair":
      return '请严格只输出单个合法 JSON 对象（不要使用 Markdown 代码块），必须包含字段：{"files":[{"path":"src/App.tsx","content":"完整 TypeScript/TSX 源码"}],"summary":"一句话中文总结"}；files 数组每项必须同时包含 path 和完整源码 content 字符串。';
    case "qa":
    case "qa-review-judge":
      return '请严格只输出单个合法 JSON 对象（不要使用 Markdown 代码块），必须包含字段：{"verdicts":[{"criterion":"与输入 acceptance 完全逐字一致","verdict":"pass"|"fail"|"unverified","reason":"引用该条标准自身证据的中文判定理由"}]}；仅当存在 fail 项时再附加可选字段 "fixInstruction":"中文修复指令"，全部 pass/unverified 时请省略该字段。verdicts 必须逐条包含且仅包含输入 acceptance 中的每一条，不得遗漏、增删或改写 criterion 文本。每条 reason 必须不同，禁止复用同一句理由。';
    case "qa-review-plan":
      return '请严格只输出单个合法 JSON 对象（不要使用 Markdown 代码块），必须包含字段：{"cases":[{"criterion":"与输入 acceptance 完全逐字一致","strategy":"playwright"|"vitest"|"hybrid","steps":[{"type":"press"|"click"|"fill"|"wait"|"reload"|"assert"}],"vitestCode":"可选隔离Vitest测试源码","expectDescription":"中文预期说明"}]}。';
    default:
      return undefined;
  }
}

export async function fetchDeepSeekResult(
  input: GeminiCompleteInput,
  config: DeepSeekConfig,
): Promise<{ text: string; usage?: TokenUsage }> {
  const { systemInstruction, userPrompt } = buildPromptForStage(input);
  const jsonContract = jsonContractForStage(input.stage);

  const baseUrl = (
    config.baseUrl?.trim() || DEFAULT_DEEPSEEK_BASE_URL
  ).replace(/\/+$/, "");
  const model = config.model?.trim() || DEFAULT_DEEPSEEK_MODEL;
  const endpoint = `${baseUrl}/chat/completions`;
  const timeoutMs =
    input.stage === "engineer" || input.stage === "engineer-repair"
      ? DEEPSEEK_TIMEOUT_ENGINEER_MS
      : DEEPSEEK_TIMEOUT_DEFAULT_MS;

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: jsonContract
          ? `${systemInstruction}\n\n${jsonContract}`
          : systemInstruction,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature:
      input.stage === "qa" ||
      input.stage === "qa-review-plan" ||
      input.stage === "qa-review-judge"
        ? 0.1
        : 0.3,
    ...(jsonContract ? { response_format: { type: "json_object" } } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `DeepSeek HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const rawText = payload.choices?.[0]?.message?.content?.trim();
    if (!rawText) {
      throw new Error("DeepSeek returned an empty completion");
    }

    const u = payload.usage;
    let usage: TokenUsage | undefined;
    if (u && typeof u === "object") {
      const tokensIn =
        typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
      const tokensOut =
        typeof u.completion_tokens === "number"
          ? u.completion_tokens
          : Math.max(
              0,
              (typeof u.total_tokens === "number" ? u.total_tokens : 0) -
                tokensIn,
            );
      if (tokensIn + tokensOut > 0) {
        usage = { tokensIn, tokensOut };
      }
    }

    return {
      text: jsonContract ? stripJsonFence(rawText) : rawText,
      ...(usage ? { usage } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}
