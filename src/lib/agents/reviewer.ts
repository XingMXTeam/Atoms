import { modelClassForStage } from "@/lib/llm/model-routing";
import type { LlmProvider } from "@/lib/llm/types";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import {
  buildFallbackReviewPlan,
  sandboxReviewPlanSchema,
  type ReviewCaseEvidence,
  type ReviewStrategy,
  type SandboxReviewPlan,
  type SandboxReviewReport,
} from "@/lib/sandbox/review-types";
import type { SandboxFile } from "@/lib/sandbox/types";
import {
  aggregateQaScore,
  computeQaCoverage,
  qaVerdictSchema,
  type QaResult,
  type QaVerdict,
  type QaVerifiedBy,
} from "./qa";

const reviewJudgeSchema = qaVerdictSchema;

function verifiedByForStrategy(strategy: ReviewStrategy): QaVerifiedBy {
  if (strategy === "vitest") return "vitest-review";
  if (strategy === "hybrid") return "hybrid-review";
  return "playwright-review";
}

function summarizeFilesForPlanner(
  files: SandboxFile[],
): Array<{ path: string; exports: string[]; snippet: string }> {
  return files.slice(0, 8).map((file) => {
    const exports: string[] = [];
    const re = /export\s+(?:default\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.content)) !== null) {
      if (m[1]) exports.push(m[1]);
    }
    return {
      path: file.path,
      exports: exports.slice(0, 20),
      snippet: file.content.slice(0, 1_600),
    };
  });
}

/**
 * Generates an executable Playwright + isolated Vitest review plan for criteria
 * that static probes left `unverified`. Falls back deterministically when LLM
 * planning is unavailable (e.g. mock/replay mode or parse failure).
 */
export async function planInteractiveReview(
  provider: LlmProvider,
  input: {
    unverifiedCriteria: string[];
    probe: PreviewProbeReport;
    files: SandboxFile[];
  },
): Promise<SandboxReviewPlan> {
  const fallback = buildFallbackReviewPlan(
    input.unverifiedCriteria,
    input.probe,
  );

  if (provider.mode === "mock" || provider.mode === "replay") {
    return fallback;
  }

  try {
    const completion = await provider.complete({
      stage: "qa-review-plan",
      modelClass: modelClassForStage("qa"),
      acceptance: input.unverifiedCriteria,
      probe: input.probe,
      fileSummaries: summarizeFilesForPlanner(input.files),
      responseSchema: sandboxReviewPlanSchema,
    });
    const parsed = sandboxReviewPlanSchema.parse(JSON.parse(completion.text));
    const byCriterion = new Map(parsed.cases.map((c) => [c.criterion, c]));
    const fallbackByCriterion = new Map(fallback.cases.map((c) => [c.criterion, c]));

    const merged = input.unverifiedCriteria.map((criterion) => {
      const planned = byCriterion.get(criterion);
      if (planned) return planned;
      return fallbackByCriterion.get(criterion)!;
    });
    return { cases: merged };
  } catch {
    return fallback;
  }
}

function stripScreenshotsForJudge(report: SandboxReviewReport) {
  return {
    backend: report.backend,
    isolated: report.isolated,
    artifactSha256: report.artifactSha256,
    ok: report.ok,
    errors: report.errors,
    cases: report.cases.map((c) => ({
      criterion: c.criterion,
      strategy: c.strategy,
      status: c.status,
      summary: c.summary,
      hasScreenshot: Boolean(c.screenshotDataUrl),
      steps: c.steps,
      vitestCommand: c.vitestCommand
        ? {
            command: c.vitestCommand.command,
            exitCode: c.vitestCommand.exitCode,
            stdout: c.vitestCommand.stdout.slice(-1_200),
            stderr: c.vitestCommand.stderr.slice(-1_200),
            durationMs: c.vitestCommand.durationMs,
          }
        : undefined,
      consoleErrors: c.consoleErrors,
      pageErrors: c.pageErrors,
      storageBefore: c.storageBefore,
      storageAfter: c.storageAfter,
      durationMs: c.durationMs,
    })),
  };
}

function deterministicAdjudication(
  unverifiedCriteria: string[],
  caseByCriterion: Map<string, ReviewCaseEvidence>,
): { verdicts: QaVerdict[]; fixInstruction?: string } {
  const verdicts: QaVerdict[] = [];
  const failures: string[] = [];

  for (const criterion of unverifiedCriteria) {
    const evidence = caseByCriterion.get(criterion);
    if (!evidence || evidence.status === "not_performed") {
      verdicts.push({
        criterion,
        verdict: "unverified",
        reason: evidence?.summary
          ? `智能复核未完成：${evidence.summary}`
          : "智能复核未覆盖该条目，仍需人工复核",
      });
      continue;
    }

    const verifiedBy = verifiedByForStrategy(evidence.strategy);
    if (evidence.status === "passed") {
      verdicts.push({
        criterion,
        verdict: "pass",
        reason: evidence.summary,
        verifiedBy,
      });
    } else {
      verdicts.push({
        criterion,
        verdict: "fail",
        reason: evidence.summary,
        verifiedBy,
      });
      failures.push(`${criterion}：${evidence.summary}`);
    }
  }

  return {
    verdicts,
    ...(failures.length > 0
      ? { fixInstruction: `根据沙箱智能复核结果修复以下交互/边界缺陷：${failures.join("；")}` }
      : {}),
  };
}

/**
 * Isolated Reviewer Judge (faithful to momo-agent-skills/src/review.js):
 * - Enforces SHA-256 artifact binding before accepting any evidence.
 * - Never allows a `not_performed` case to become `pass`.
 * - Never allows runtime/Vitest failures to be whitewashed into `pass`.
 * - Receives zero Engineer source code or reasoning.
 */
export async function adjudicateReviewReport(
  provider: LlmProvider,
  input: {
    unverifiedCriteria: string[];
    reviewReport: SandboxReviewReport;
    expectedSha256: string;
  },
): Promise<{ verdicts: QaVerdict[]; fixInstruction?: string }> {
  if (input.reviewReport.artifactSha256 !== input.expectedSha256) {
    return {
      verdicts: input.unverifiedCriteria.map((criterion) => ({
        criterion,
        verdict: "unverified",
        reason: "复核证据 SHA-256 与当前产物不一致，已拒绝合并，需重新复核",
      })),
    };
  }

  const caseByCriterion = new Map(
    input.reviewReport.cases.map((c) => [c.criterion, c]),
  );
  const deterministic = deterministicAdjudication(
    input.unverifiedCriteria,
    caseByCriterion,
  );

  if (provider.mode === "mock" || provider.mode === "replay") {
    return deterministic;
  }

  try {
    const completion = await provider.complete({
      stage: "qa-review-judge",
      modelClass: modelClassForStage("qa"),
      acceptance: input.unverifiedCriteria,
      reviewReport: stripScreenshotsForJudge(input.reviewReport),
      responseSchema: reviewJudgeSchema,
    });
    const parsed = reviewJudgeSchema.parse(JSON.parse(completion.text));
    const llmByCriterion = new Map(parsed.verdicts.map((v) => [v.criterion, v]));

    const finalVerdicts: QaVerdict[] = [];
    const hardFailures: string[] = [];

    for (const criterion of input.unverifiedCriteria) {
      const evidence = caseByCriterion.get(criterion);
      if (!evidence || evidence.status === "not_performed") {
        // Anti-self-report invariant: unperformed assertions NEVER become pass.
        finalVerdicts.push({
          criterion,
          verdict: "unverified",
          reason: evidence?.summary
            ? `智能复核未完成：${evidence.summary}`
            : "智能复核未能执行该条目，仍需人工复核",
        });
        continue;
      }

      const verifiedBy = verifiedByForStrategy(evidence.strategy);
      const hasHardExecutionError =
        evidence.status === "failed" ||
        evidence.consoleErrors.length > 0 ||
        evidence.pageErrors.length > 0 ||
        (evidence.vitestCommand !== undefined && evidence.vitestCommand.exitCode !== 0);

      const llmVerdict = llmByCriterion.get(criterion);
      if (hasHardExecutionError) {
        const reason =
          llmVerdict && llmVerdict.verdict === "fail"
            ? llmVerdict.reason
            : evidence.summary;
        finalVerdicts.push({
          criterion,
          verdict: "fail",
          reason,
          verifiedBy,
        });
        hardFailures.push(`${criterion}：${reason}`);
      } else if (llmVerdict) {
        finalVerdicts.push({
          criterion,
          verdict: llmVerdict.verdict,
          reason: llmVerdict.reason,
          ...(llmVerdict.verdict === "unverified" ? {} : { verifiedBy }),
        });
        if (llmVerdict.verdict === "fail") {
          hardFailures.push(`${criterion}：${llmVerdict.reason}`);
        }
      } else {
        finalVerdicts.push({
          criterion,
          verdict: "pass",
          reason: evidence.summary,
          verifiedBy,
        });
      }
    }

    const fixInstruction =
      hardFailures.length > 0
        ? parsed.fixInstruction?.trim() ||
          `根据沙箱智能复核结果修复以下交互/边界缺陷：${hardFailures.join("；")}`
        : undefined;

    return {
      verdicts: finalVerdicts,
      ...(fixInstruction ? { fixInstruction } : {}),
    };
  } catch {
    return deterministic;
  }
}

export function mergeReviewedVerdicts(
  initial: QaResult,
  reviewed: { verdicts: QaVerdict[]; fixInstruction?: string },
): QaResult {
  const reviewedByCriterion = new Map(
    reviewed.verdicts.map((v) => [v.criterion, v]),
  );

  const mergedVerdicts: QaVerdict[] = initial.verdicts.map((existing) => {
    if (existing.verdict !== "unverified") {
      return existing.verifiedBy
        ? existing
        : { ...existing, verifiedBy: "static-probe" };
    }
    const replacement = reviewedByCriterion.get(existing.criterion);
    return replacement ?? existing;
  });

  const coverage = computeQaCoverage(mergedVerdicts);
  const fixParts = [initial.fixInstruction, reviewed.fixInstruction]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return {
    verdicts: mergedVerdicts,
    qa_score: aggregateQaScore(mergedVerdicts),
    ...(coverage.unverified > 0 ? { coverage } : {}),
    ...(fixParts.length > 0 ? { fixInstruction: fixParts.join("；") } : {}),
  };
}
