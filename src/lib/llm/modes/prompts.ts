import type { ModelClass } from "../model-routing";

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
        "1. 只能导入 `react`、`react-dom/client` 以及本地相对路径 `./...`；严禁导入未安装的第三方包（包括 `vitest`、`@testing-library/react`），严禁创建 `*.test.ts`/`*.test.tsx` 测试文件，严禁引用任何外部 CDN URL。",
        "2. 必须确保 `src/main.tsx` 使用 `createRoot(document.getElementById(\"root\")!).render(<App />)` 挂载，`src/App.tsx` 使用 `export default function App()`。",
        "3. 预览运行在无 allow-same-origin 权限的沙箱 iframe 中，宿主已通过安全存储桥代理 `localStorage`（并持久化到服务端数据库）：必须将完整运行态持久化到 `localStorage`（配 `try/catch`）并在初始化时恢复——例如待办/列表应用必须持久化全部条目与完成状态；2048 等游戏应用必须在每步移动后持久化当前完整棋盘矩阵（board/grid）、当前得分（score）与最高分（bestScore），确保刷新页面后直接恢复刚才的盘面和分数，仅在点击「重新开始」时重置。严禁调用 `document.cookie`。若使用 `<form>`，必须在 `onSubmit` 调用 `e.preventDefault()` 或直接使用 `button type=\"button\"` 搭配 `onClick` 与键盘 Enter 事件，确保点击添加或提交始终触发。",
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
        "硬性约束：只导入 `react` / `react-dom/client` 与本地相对路径，严禁创建 `*.test.ts`/`*.test.tsx` 或导入测试库；完整业务/游戏状态（如待办列表、2048 当前棋盘与分数）必须通过宿主安全代理的 `localStorage`（配 `try/catch`）持久化，严禁调用 `document.cookie`；表单提交必须使用 `e.preventDefault()` 或 `onClick`；保留原有视觉与样式，只返回本次需要修改的文件，保证代码能正确渲染可见内容。严格输出 JSON。",
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
        "3. `verdict` 支持三态：`pass`（已验证通过）、`fail`（存在编译/运行错误、白屏或明显缺失核心界面）、`unverified`（无错误且界面已渲染，但该条依赖长时倒计时归零、真实音频或复杂多步按键状态机，渲染探针无法直接验证，需人工复核）。严禁把「探针无法模拟」判为 `fail`，严禁在 `fixInstruction` 中要求编写 `.test.tsx` 或引入 `vitest` / `@testing-library/react`。",
        "4. 每条 `reason` 必须引用该条标准自己的证据（可见文案、控件名称或具体错误），禁止多条标准复用同一句理由。",
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

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}
