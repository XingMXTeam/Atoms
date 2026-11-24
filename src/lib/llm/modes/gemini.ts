import { DEFAULT_GEMINI_MODEL_FLASH } from "@/lib/env";
import { resolveModelId, type ModelClass } from "../model-routing";
import type { LlmCompletion, LlmProvider } from "../types";
import { createReplayProvider, REPLAY_LABEL } from "./replay";

export type GeminiProviderOptions = {
  apiKey?: string;
  /** Optional transport hook for streaming / unit tests. */
  fetchCompletion?: (
    input: GeminiCompleteInput & { modelId: string },
    apiKey: string,
  ) => Promise<string>;
};

export type GeminiCompleteInput = {
  prompt?: string;
  stage?: string;
  modelClass?: ModelClass;
  responseSchema?: unknown;
  plan?: unknown;
  design?: unknown;
  currentFiles?: Array<{ path: string; content: string }>;
  history?: Array<{ role: "user" | "agent"; content: string }>;
  fixInstruction?: string;
  acceptance?: string[];
  probe?: unknown;
  [key: string]: unknown;
};

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 45_000;
const FLASH_TRANSIENT_RETRY_DELAY_MS = 1_000;

type GeminiSchemaNode = {
  type: "OBJECT" | "ARRAY" | "STRING" | "BOOLEAN" | "INTEGER" | "NUMBER";
  properties?: Record<string, GeminiSchemaNode>;
  required?: string[];
  items?: GeminiSchemaNode;
  enum?: string[];
};

function responseSchemaForStage(stage?: string): GeminiSchemaNode | undefined {
  switch (stage) {
    case "planner":
      return {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          prd: { type: "STRING" },
          acceptance: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "prd", "acceptance"],
      };
    case "architect":
      return {
        type: "OBJECT",
        properties: {
          files: { type: "ARRAY", items: { type: "STRING" } },
          components: { type: "ARRAY", items: { type: "STRING" } },
          data: { type: "ARRAY", items: { type: "STRING" } },
          notes: { type: "STRING" },
        },
        required: ["files", "components", "data", "notes"],
      };
    case "engineer":
    case "engineer-repair":
      return {
        type: "OBJECT",
        properties: {
          files: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                path: { type: "STRING" },
                content: { type: "STRING" },
              },
              required: ["path", "content"],
            },
          },
          summary: { type: "STRING" },
        },
        required: ["files", "summary"],
      };
    case "qa":
      return {
        type: "OBJECT",
        properties: {
          verdicts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                criterion: { type: "STRING" },
                verdict: { type: "STRING", enum: ["pass", "fail"] },
                reason: { type: "STRING" },
              },
              required: ["criterion", "verdict", "reason"],
            },
          },
          fixInstruction: { type: "STRING" },
        },
        required: ["verdicts"],
      };
    default:
      return undefined;
  }
}

export function buildPromptForStage(input: GeminiCompleteInput): {
  systemInstruction: string;
  userPrompt: string;
} {
  const stage = input.stage ?? "general";
  const hasCurrentFiles =
    Array.isArray(input.currentFiles) && input.currentFiles.length > 0;
  const recentHistory = Array.isArray(input.history)
    ? input.history.slice(-8)
    : [];
  const isFollowUp = hasCurrentFiles || recentHistory.length > 1;
  const currentFilePaths = (input.currentFiles ?? []).map((file) => file.path);

  if (stage === "planner") {
    return {
      systemInstruction: isFollowUp
        ? "你是 Atoms Studio 的规划师 (Planner)。当前是增量迭代或问题修复，请结合对话历史（history）与现有文件列表（currentFiles）理解上下文，保留已完成的视觉优化与既有核心功能，只针对用户最新诉求输出精确的中文增量 PRD 与 3-5 条验收标准（以 `AC-1`、`AC-2` 等开头）。严格输出 JSON。"
        : "你是 Atoms Studio 的规划师 (Planner)。根据用户需求输出简洁、可验证的简体中文迷你 PRD 与 3-5 条验收标准。每条验收标准以 `AC-1`、`AC-2` 等开头。严格输出 JSON。",
      userPrompt: isFollowUp
        ? JSON.stringify({
            prompt: input.prompt ?? "",
            history: recentHistory,
            currentFiles: currentFilePaths,
          })
        : `用户需求：${input.prompt ?? ""}`,
    };
  }

  if (stage === "architect") {
    return {
      systemInstruction: isFollowUp
        ? "你是 Atoms Studio 的架构师 (Architect)。当前是在既有前端原型上的增量迭代或修复，必须沿用并保留现有文件结构（currentFiles）及已优化的界面架构，仅在确有必要时增改文件。禁止后端服务、外部 npm 依赖或外部 CDN，禁止使用需要同源权限的浏览器存储。全部使用简体中文说明。严格输出 JSON。"
        : "你是 Atoms Studio 的架构师 (Architect)。为前端浏览器单页 React + TypeScript 原型设计文件结构（必须包含 src/main.tsx 与 src/App.tsx，总计 2-5 个文件）、组件列表与客户端状态结构。禁止后端服务、外部 npm 依赖或外部 CDN。全部使用简体中文说明。严格输出 JSON。",
      userPrompt: JSON.stringify({
        prompt: input.prompt ?? "",
        plan: input.plan ?? null,
        ...(isFollowUp
          ? { history: recentHistory, currentFiles: currentFilePaths }
          : {}),
      }),
    };
  }

  if (stage === "engineer") {
    return {
      systemInstruction: [
        "你是 Atoms Studio 的全栈工程师 (Engineer)。编写可直接由浏览器内 esbuild-wasm 打包的 React + TypeScript 应用。",
        "硬性约束：",
        "1. 只能导入 `react`、`react-dom/client` 以及本地相对路径 `./...`；严禁导入未安装的第三方包，严禁引用任何外部 CDN URL。",
        "2. 必须确保 `src/main.tsx` 使用 `createRoot(document.getElementById(\"root\")!).render(<App />)` 挂载，`src/App.tsx` 使用 `export default function App()`。",
        "3. 预览运行在无 allow-same-origin 权限的沙箱 iframe 中：严禁调用 `localStorage`、`sessionStorage` 或 `document.cookie`（会触发 SecurityError 导致功能失效），全部状态必须保留在 React `useState` / `useReducer` 中。若使用 `<form>`，必须在 `onSubmit` 调用 `e.preventDefault()` 或直接使用 `button type=\"button\"` 搭配 `onClick` 与键盘 Enter 事件，确保点击添加或提交始终触发。",
        "4. 界面文案全部使用简体中文，页面结构清晰美观（可使用 Tailwind CSS v4 工具类）、具备真实可交互状态。",
        hasCurrentFiles
          ? "5. 这是基于现有版本的增量迭代/缺陷修复：必须完整保留 `currentFiles` 中既有的视觉设计、Tailwind 样式、布局结构和未要求改动的既有功能，只返回需要修复或增强的文件，禁止推倒重写或退化为无样式骨架，并在 summary 用一句话总结改动。"
          : "5. 首次生成请控制文件数量在 2-6 个以内，并在 summary 用一句话说明实现。",
        "严格输出 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        prompt: input.prompt ?? "",
        plan: input.plan ?? null,
        design: input.design ?? null,
        ...(recentHistory.length > 0 ? { history: recentHistory } : {}),
        ...(hasCurrentFiles ? { currentFiles: input.currentFiles } : {}),
      }),
    };
  }

  if (stage === "engineer-repair") {
    return {
      systemInstruction: [
        "你是 Atoms Studio 的全栈工程师 (Engineer)。根据 QA 修复指令修复现有 React + TS 文件中的编译错误、运行时异常或白屏问题。",
        "硬性约束：只导入 `react` / `react-dom/client` 与本地相对路径；严禁调用 `localStorage`、`sessionStorage` 或 `document.cookie`；表单提交必须使用 `e.preventDefault()` 或 `onClick`；保留原有视觉与样式，只返回本次需要修改的文件，保证代码能正确渲染可见内容。严格输出 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        prompt: input.prompt ?? "",
        fixInstruction: input.fixInstruction ?? "",
        plan: input.plan ?? null,
        design: input.design ?? null,
        currentFiles: input.currentFiles ?? [],
      }),
    };
  }

  if (stage === "qa") {
    return {
      systemInstruction: [
        "你是 Atoms Studio 的质检专家 (QA)。根据验收标准列表 (acceptance) 与预览探针报告 (probe) 逐条判定。",
        "硬性约束：",
        "1. `verdicts` 数组必须包含且仅包含 `acceptance` 中的每一条标准，`criterion` 字段必须与输入完全一致。",
        "2. 如果 probe 中存在 compileErrors、runtimeErrors 或 blankScreen 为 true，相应标准必须判为 `fail`，并给出具体中文 reason 与清晰的 `fixInstruction`。",
        "3. 全部正常且 DOM 摘要显示有内容渲染时判为 `pass`。",
        "严格输出 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        acceptance: input.acceptance ?? [],
        probe: input.probe ?? null,
      }),
    };
  }

  return {
    systemInstruction: "你是 Atoms Studio 的 AI 助手，请使用简体中文回答。",
    userPrompt: input.prompt ?? JSON.stringify(input),
  };
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

export async function defaultFetchGeminiCompletion(
  input: GeminiCompleteInput & { modelId: string },
  apiKey: string,
): Promise<string> {
  const { systemInstruction, userPrompt } = buildPromptForStage(input);
  const schema = responseSchemaForStage(input.stage);

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: input.stage === "qa" ? 0.1 : 0.3,
      ...(input.modelId.startsWith("gemini-3")
        ? { thinkingConfig: { thinkingLevel: "low" } }
        : {}),
      ...(schema
        ? {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        : {}),
    },
  };

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(input.modelId)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`Gemini HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!rawText) {
      throw new Error("Gemini returned an empty completion");
    }

    return schema ? stripJsonFence(rawText) : rawText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini REST provider.
 * Uses Flash for Planner/Architect/QA and Pro for Engineer (REQ-8).
 * Missing key or transport failure → auto-fallback to replay + 「演示回放」 (REQ-5).
 */
export function createGeminiProvider(
  options: GeminiProviderOptions = {},
): LlmProvider {
  const replay = createReplayProvider();
  const transport = options.fetchCompletion ?? defaultFetchGeminiCompletion;

  return {
    mode: "gemini",
    async complete(input: unknown): Promise<LlmCompletion> {
      const typed =
        input && typeof input === "object"
          ? (input as GeminiCompleteInput)
          : ({ prompt: String(input) } as GeminiCompleteInput);

      const isFollowUp =
        Array.isArray(typed.currentFiles) && typed.currentFiles.length > 0;
      const modelClass: ModelClass =
        typed.modelClass === "pro" ? "pro" : "flash";
      const modelId = resolveModelId(modelClass);

      const apiKey = options.apiKey?.trim() ?? "";
      if (!apiKey) {
        console.warn("[gemini-fallback]", {
          stage: typed.stage ?? "general",
          modelId,
          hasKey: false,
          reason: "missing_api_key",
        });
        if (isFollowUp) {
          throw new Error("上游模型暂时不可用，已保留当前版本，请稍后重试");
        }
        const fallback = await replay.complete(input);
        return {
          text: fallback.text,
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }

      try {
        const text = await transport({ ...typed, modelClass, modelId }, apiKey);
        return { text, meta: { mode: "gemini" } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const canFallbackToFlash =
          modelId !== DEFAULT_GEMINI_MODEL_FLASH &&
          (message.includes("Gemini HTTP 404") ||
            message.includes("Gemini HTTP 429") ||
            message.includes("Gemini HTTP 503") ||
            message.includes("aborted"));
        const canRetryTransientFlash =
          modelId === DEFAULT_GEMINI_MODEL_FLASH &&
          (message.includes("Gemini HTTP 503") ||
            message.includes("Gemini HTTP 429"));

        if (canFallbackToFlash || canRetryTransientFlash) {
          if (canRetryTransientFlash) {
            await new Promise((resolve) =>
              setTimeout(resolve, FLASH_TRANSIENT_RETRY_DELAY_MS),
            );
          }
          try {
            const text = await transport(
              { ...typed, modelClass: "flash", modelId: DEFAULT_GEMINI_MODEL_FLASH },
              apiKey,
            );
            return { text, meta: { mode: "gemini" } };
          } catch (retryError) {
            console.warn("[gemini-fallback]", {
              stage: typed.stage ?? "general",
              modelId: DEFAULT_GEMINI_MODEL_FLASH,
              hasKey: true,
              reason:
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError),
            });
          }
        } else {
          console.warn("[gemini-fallback]", {
            stage: typed.stage ?? "general",
            modelId,
            hasKey: true,
            reason: message,
          });
        }
        if (isFollowUp) {
          throw new Error("上游模型暂时不可用，已保留当前版本，请稍后重试");
        }
        const fallback = await replay.complete(input);
        return {
          text: fallback.text,
          meta: { mode: "replay", label: REPLAY_LABEL },
        };
      }
    },
  };
}
