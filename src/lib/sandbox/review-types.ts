import { z } from "zod";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import type { SandboxBackend, SandboxCommandResult, SandboxFile } from "./types";

const MAX_WAIT_MS = 2_000;
const MAX_PRESS_COUNT = 12;

export const reviewActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("press"),
    key: z.string().min(1).max(32),
    count: z.number().int().min(1).max(MAX_PRESS_COUNT).optional(),
  }),
  z.object({
    type: z.literal("click"),
    text: z.string().min(1).max(80).optional(),
    role: z.enum(["button", "checkbox", "link", "tab"]).optional(),
    selector: z.string().min(1).max(120).optional(),
  }),
  z.object({
    type: z.literal("fill"),
    text: z.string().max(200),
    label: z.string().min(1).max(80).optional(),
    placeholder: z.string().min(1).max(80).optional(),
    selector: z.string().min(1).max(120).optional(),
  }),
  z.object({
    type: z.literal("wait"),
    ms: z.number().int().min(50).max(MAX_WAIT_MS),
  }),
  z.object({
    type: z.literal("reload"),
  }),
  z.object({
    type: z.literal("assert"),
    expectText: z.string().min(1).max(120).optional(),
    expectTextChanged: z.boolean().optional(),
    expectStorageChanged: z.boolean().optional(),
    expectNoErrors: z.boolean().optional(),
    expectVisible: z.string().min(1).max(120).optional(),
  }),
]);

export type ReviewAction = z.infer<typeof reviewActionSchema>;

export const reviewStrategySchema = z.enum(["playwright", "vitest", "hybrid"]);
export type ReviewStrategy = z.infer<typeof reviewStrategySchema>;

export const reviewCasePlanSchema = z.object({
  criterion: z.string().min(1),
  strategy: reviewStrategySchema,
  steps: z.array(reviewActionSchema).max(16).optional(),
  vitestCode: z.string().max(12_000).optional(),
  expectDescription: z.string().min(1).max(300),
});

export type ReviewCasePlan = z.infer<typeof reviewCasePlanSchema>;

export const sandboxReviewPlanSchema = z.object({
  cases: z.array(reviewCasePlanSchema).min(1).max(12),
});

export type SandboxReviewPlan = z.infer<typeof sandboxReviewPlanSchema>;

export const reviewStepTraceSchema = z.object({
  stepIndex: z.number().int().min(0),
  action: z.string().min(1),
  ok: z.boolean(),
  beforeSummary: z.string().max(400).optional(),
  afterSummary: z.string().max(400).optional(),
  changed: z.boolean().optional(),
  error: z.string().max(400).optional(),
  durationMs: z.number().int().min(0),
});

export type ReviewStepTrace = z.infer<typeof reviewStepTraceSchema>;

const sandboxCommandResultSchema = z.object({
  command: z.string(),
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().int().min(0),
});

export const reviewCaseEvidenceSchema = z.object({
  criterion: z.string().min(1),
  strategy: reviewStrategySchema,
  status: z.enum(["passed", "failed", "not_performed"]),
  summary: z.string().min(1).max(600),
  steps: z.array(reviewStepTraceSchema),
  screenshotDataUrl: z.string().max(120_000).optional(),
  screenshotLabel: z.string().max(120).optional(),
  vitestCommand: sandboxCommandResultSchema.optional(),
  consoleErrors: z.array(z.string().max(400)).max(20),
  pageErrors: z.array(z.string().max(400)).max(20),
  storageBefore: z.record(z.string(), z.string()).optional(),
  storageAfter: z.record(z.string(), z.string()).optional(),
  durationMs: z.number().int().min(0),
});

export type ReviewCaseEvidence = z.infer<typeof reviewCaseEvidenceSchema>;

export const sandboxReviewReportSchema = z.object({
  backend: z.enum([
    "cloudflare-sandbox",
    "local-node-sandbox",
    "worker-static-verifier",
  ]),
  isolated: z.boolean(),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  ok: z.boolean(),
  cases: z.array(reviewCaseEvidenceSchema),
  commands: z.array(sandboxCommandResultSchema),
  errors: z.array(z.string()),
  durationMs: z.number().int().min(0),
});

export type SandboxReviewReport = {
  backend: SandboxBackend;
  isolated: boolean;
  artifactSha256: string;
  ok: boolean;
  cases: ReviewCaseEvidence[];
  commands: SandboxCommandResult[];
  errors: string[];
  durationMs: number;
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}

/**
 * Deterministic SHA-256 over the sorted generated file bundle.
 * Uses Web Crypto so Cloudflare Workers and Node compute identical hashes.
 */
export async function computeFilesSha256(files: SandboxFile[]): Promise<string> {
  const canonical = [...files]
    .map((f) => ({ path: normalizePath(f.path), content: f.content }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}\0${f.content}\0`)
    .join("");
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const FORBIDDEN_VITEST_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(?:node:)?(?:child_process|fs|net|http|https|http2|dgram|tls|dns|cluster|worker_threads|vm|v8|inspector|os|perf_hooks)\b/,
    reason: "禁止在动态单测中引用 Node 系统/网络/文件系统模块",
  },
  {
    re: /\b(?:process\.env|process\.exit|process\.kill|process\.binding|globalThis\.process)\b/,
    reason: "禁止访问 process 环境或进程控制接口",
  },
  {
    re: /\b(?:eval|Function)\s*\(/,
    reason: "禁止使用 eval 或 Function 动态代码执行",
  },
  {
    re: /\brequire\s*\(/,
    reason: "动态单测必须使用 ESM import，禁止 require()",
  },
  {
    re: /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/,
    reason: "动态单测禁止发起网络请求",
  },
  {
    re: /https?:\/\//i,
    reason: "动态单测禁止包含外部 URL",
  },
  {
    re: /from\s+['"]\.\.\/\.\.\//,
    reason: "禁止越界导入工作区外部文件",
  },
];

const ALLOWED_VITEST_PACKAGES = new Set([
  "vitest",
  "@testing-library/react",
  "react",
  "react-dom",
  "react-dom/client",
  "react-dom/test-utils",
]);

const IMPORT_SPEC_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

/**
 * Static safety gate executed before writing any LLM-generated Vitest code
 * to an isolated sandbox workspace.
 */
export function validateVitestCodeSafety(
  code: string,
): { ok: true } | { ok: false; reason: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: "测试代码为空" };
  }
  if (trimmed.length > 12_000) {
    return { ok: false, reason: "测试代码超过最大长度限制 (12KB)" };
  }
  for (const { re, reason } of FORBIDDEN_VITEST_PATTERNS) {
    if (re.test(trimmed)) {
      return { ok: false, reason };
    }
  }
  IMPORT_SPEC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_SPEC_RE.exec(trimmed)) !== null) {
    const spec = match[1] ?? "";
    if (spec.startsWith("./") || spec.startsWith("../src/")) continue;
    if (spec.startsWith("../")) {
      return { ok: false, reason: `禁止导入非 src 相对路径 "${spec}"` };
    }
    if (!ALLOWED_VITEST_PACKAGES.has(spec)) {
      return { ok: false, reason: `禁止导入未授权依赖 "${spec}"` };
    }
  }
  return { ok: true };
}

function findMatchingButton(labels: string[], patterns: RegExp[]): string | undefined {
  for (const label of labels) {
    if (patterns.some((re) => re.test(label))) {
      return label;
    }
  }
  return undefined;
}

/**
 * Deterministic heuristic review plan generator used as fallback when LLM
 * review-plan generation is unavailable (e.g. mock/replay mode or parse failure).
 */
export function buildFallbackReviewPlan(
  criteria: string[],
  probe: PreviewProbeReport,
): SandboxReviewPlan {
  const buttonLabels = probe.interactionSummary?.buttonLabels ?? [];
  const inputCount = probe.interactionSummary?.inputCount ?? 0;

  const cases: ReviewCasePlan[] = criteria.map((criterion) => {
    // 1. Reset / restart button interactions
    if (/重置|重新开始|清空|新游戏|reset|restart/i.test(criterion)) {
      const resetLabel = findMatchingButton(buttonLabels, [
        /重新开始|重置|新游戏|清空|reset|restart/i,
      ]);
      const steps: ReviewAction[] = [
        { type: "press", key: "ArrowLeft", count: 2 },
        { type: "press", key: "ArrowUp", count: 2 },
        ...(resetLabel
          ? [{ type: "click" as const, text: resetLabel, role: "button" as const }]
          : [{ type: "click" as const, role: "button" as const }]),
        { type: "wait", ms: 150 },
        { type: "assert", expectNoErrors: true, expectTextChanged: true },
      ];
      return {
        criterion,
        strategy: "playwright",
        steps,
        expectDescription: "点击重置/重新开始按钮后界面状态更新且无运行时错误",
      };
    }

    // 2. Keyboard movement / 2048 / game controls
    if (/键盘|方向键|上下左右|移动|合并|方块|随机空位|新数字|生成/i.test(criterion)) {
      return {
        criterion,
        strategy: "playwright",
        steps: [
          { type: "press", key: "ArrowLeft", count: 1 },
          { type: "wait", ms: 100 },
          { type: "press", key: "ArrowDown", count: 1 },
          { type: "wait", ms: 100 },
          { type: "press", key: "ArrowRight", count: 1 },
          { type: "wait", ms: 100 },
          { type: "press", key: "ArrowUp", count: 1 },
          { type: "assert", expectTextChanged: true, expectNoErrors: true },
        ],
        expectDescription: "方向键交互后棋盘文本或状态发生变化，且无控制台或运行异常",
      };
    }

    // 3. Persistence across page reload
    if (/刷新|持久化|保留|恢复|重启|localStorage|存储/i.test(criterion)) {
      const steps: ReviewAction[] = [];
      if (inputCount > 0) {
        steps.push({ type: "fill", text: "自动化持久化验证条目" });
        const addBtn = findMatchingButton(buttonLabels, [/添加|新增|提交|创建|保存|add/i]);
        if (addBtn) {
          steps.push({ type: "click", text: addBtn, role: "button" });
        } else {
          steps.push({ type: "press", key: "Enter", count: 1 });
        }
      } else {
        steps.push({ type: "press", key: "ArrowLeft", count: 2 });
        steps.push({ type: "press", key: "ArrowUp", count: 1 });
      }
      steps.push({ type: "wait", ms: 150 });
      steps.push({ type: "reload" });
      steps.push({ type: "wait", ms: 250 });
      steps.push({ type: "assert", expectStorageChanged: true, expectNoErrors: true });
      return {
        criterion,
        strategy: "playwright",
        steps,
        expectDescription: "执行交互并刷新页面后，持久化存储仍保留非空状态且页面无异常",
      };
    }

    // 4. Form / input / todo add interactions
    if (inputCount > 0 && /新增|添加|创建|输入|搜索|提交|任务|待办/i.test(criterion)) {
      const addBtn = findMatchingButton(buttonLabels, [/添加|新增|提交|创建|保存|add/i]);
      return {
        criterion,
        strategy: "playwright",
        steps: [
          { type: "fill", text: "智能复核测试任务" },
          ...(addBtn
            ? [{ type: "click" as const, text: addBtn, role: "button" as const }]
            : [{ type: "press" as const, key: "Enter", count: 1 }]),
          { type: "wait", ms: 150 },
          {
            type: "assert",
            expectText: "智能复核测试任务",
            expectNoErrors: true,
          },
        ],
        expectDescription: "输入并提交后页面可见新增内容，无运行时异常",
      };
    }

    // 5. Generic interactive button/control probe
    const firstBtn = buttonLabels[0];
    return {
      criterion,
      strategy: "playwright",
      steps: [
        ...(firstBtn
          ? [{ type: "click" as const, text: firstBtn, role: "button" as const }]
          : [{ type: "press" as const, key: "ArrowLeft", count: 2 }]),
        { type: "wait", ms: 150 },
        { type: "assert", expectNoErrors: true },
      ],
      expectDescription: "在真实无头浏览器中执行主交互控件后无运行时异常",
    };
  });

  return { cases };
}
