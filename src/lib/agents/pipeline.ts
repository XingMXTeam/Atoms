import type { AppRepository } from "@/lib/db/repository";
import { utcDay } from "@/lib/limits/rate-limit";
import type { LlmProvider } from "@/lib/llm/types";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import {
  runInteractiveSandboxReview,
  verifyInBackendSandbox,
  type SandboxReviewPlan,
  type SandboxReviewReport,
  type SandboxVerifyReport,
} from "@/lib/sandbox/runner";
import { computeFilesSha256 } from "@/lib/sandbox/review-types";
import { runArchitect } from "./architect";
import { runEngineer, runEngineerRepair } from "./engineer";
import { runQa, type QaResult } from "./qa";
import {
  adjudicateReviewReport,
  mergeReviewedVerdicts,
  planInteractiveReview,
} from "./reviewer";
import {
  createSeqCounter,
  type AgentEventRecord,
} from "./events";
import type { GeneratedFile, PlannerPayload } from "./fixtures";
import { runPlanner } from "./planner";
import { mergeFileDelta } from "@/lib/versions";
import { stageTiming } from "./timing";

export type PipelineResult = {
  plan: PlannerPayload;
  files: GeneratedFile[];
  versionId: string;
  summary: string;
  qaScore: number;
  qaRounds: number;
  exhausted: boolean;
};

export type RunAgentPipelineOptions = {
  repo: AppRepository;
  provider: LlmProvider;
  projectId: string;
  runId: string;
  prompt: string;
  deviceId?: string;
  history?: Array<{ role: "user" | "agent"; content: string }>;
  currentVersion?: { id: string; files: GeneratedFile[] };
  onEvent?: (event: AgentEventRecord) => void | Promise<void>;
  /** When true, skip marking the run failed on error (caller handles). */
  signal?: AbortSignal;
  /** Test-only delay between stages so e2e can force an SSE disconnect (REQ-9). */
  stageDelayMs?: number;
  /** Preview host callback; each repair is judged against a fresh report. */
  probePreview?: (
    files: GeneratedFile[],
    round: number,
  ) => Promise<PreviewProbeReport>;
  /** Optional override for backend execution sandbox verification (tests). */
  verifySandbox?: (files: GeneratedFile[]) => Promise<SandboxVerifyReport>;
  /** Optional override for sandbox Playwright/Vitest interactive reviewer (tests). */
  reviewSandbox?: (
    files: GeneratedFile[],
    plan: SandboxReviewPlan,
    expectedSha256: string,
  ) => Promise<SandboxReviewReport | null>;
  /**
   * `platform` counts tokens against the platform budget.
   * `visitor` (BYOK) records run tokens but does not touch that budget.
   * Omitted keeps the historical device `usage.tokens` counter.
   */
  billTo?: "platform" | "visitor";
};

async function delayStage(ms: number | undefined, signal?: AbortSignal) {
  if (!ms || ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function persistEvent(
  repo: AppRepository,
  input: Omit<AgentEventRecord, "id">,
  onEvent?: RunAgentPipelineOptions["onEvent"],
): Promise<AgentEventRecord> {
  const event = await repo.appendAgentEvent(input);
  await onEvent?.(event);
  return event;
}

const MAX_FIX_ROUNDS = 3;

export function defaultProbe(files: GeneratedFile[]): PreviewProbeReport {
  const hasMockCompileError = files.some(({ content }) =>
    content.includes("/* MOCK_COMPILE_ERROR */"),
  );
  return {
    source: "atoms-preview",
    type: "probe",
    compileErrors: hasMockCompileError ? ["演示编译错误"] : [],
    runtimeErrors: [],
    blankScreen: false,
    domSummary: {
      title: "",
      text: files.map(({ content }) => content).join(" ").slice(0, 2_000),
      elementCount: files.length,
    },
  };
}

function hasProbeFailure(probe: PreviewProbeReport): boolean {
  return probe.compileErrors.length > 0 ||
    probe.runtimeErrors.length > 0 ||
    probe.blankScreen;
}

function hasQaFailure(result: QaResult): boolean {
  return result.verdicts.some(({ verdict }) => verdict === "fail");
}

export async function runAgentPipeline(
  options: RunAgentPipelineOptions,
): Promise<PipelineResult> {
  const {
    repo,
    provider,
    projectId,
    runId,
    prompt,
    deviceId,
    history,
    currentVersion,
    onEvent,
    signal,
    stageDelayMs,
    probePreview,
    verifySandbox,
    reviewSandbox,
    billTo,
  } = options;
  const nextSeq = createSeqCounter();
  let sawReplayFallback = false;
  let replayLabel: string | undefined;
  let tokensIn = 0;
  let tokensOut = 0;
  const chargeUsage = async (swallow: boolean) => {
    if (!deviceId || tokensIn + tokensOut <= 0) return;
    if (billTo === "visitor") return;
    const total = tokensIn + tokensOut;
    const write = repo.incrementUsage(deviceId, utcDay(), {
      tokens: total,
      ...(billTo === "platform" ? { platformTokens: total } : {}),
    });
    if (swallow) {
      await write.catch(() => undefined);
      return;
    }
    await write;
  };

  const trackedProvider: LlmProvider = {
    mode: provider.mode,
    async complete(input: unknown) {
      const completion = await provider.complete(input);
      if (completion.meta.mode === "replay") {
        sawReplayFallback = true;
        replayLabel = completion.meta.label ?? "演示回放";
      }
      if (completion.meta.usage) {
        tokensIn += completion.meta.usage.tokensIn;
        tokensOut += completion.meta.usage.tokensOut;
      }
      return completion;
    },
  };

  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const plannerStarted = Date.now();
    const plan = await runPlanner(trackedProvider, {
      prompt,
      ...(history ? { history } : {}),
      ...(currentVersion ? { currentFiles: currentVersion.files } : {}),
    });
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "planner",
        type: "plan",
        payload: {
          ...plan,
          timing: stageTiming(plannerStarted),
          ...(replayLabel ? { providerLabel: replayLabel } : {}),
        },
      },
      onEvent,
    );

    // Prefer Planner title only on initial creation; preserve project title during follow-ups.
    if (!currentVersion) {
      await repo.updateProjectTitle(projectId, plan.title);
    }

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const architectStarted = Date.now();
    const design = await runArchitect(trackedProvider, {
      prompt,
      plan,
      ...(history ? { history } : {}),
      ...(currentVersion ? { currentFiles: currentVersion.files } : {}),
    });
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "architect",
        type: "design",
        payload: {
          ...design,
          timing: stageTiming(architectStarted),
          ...(replayLabel ? { providerLabel: replayLabel } : {}),
        },
      },
      onEvent,
    );

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const engineerStarted = Date.now();
    const engineer = await runEngineer(trackedProvider, {
      prompt,
      plan,
      design,
      ...(history ? { history } : {}),
      ...(currentVersion ? { currentFiles: currentVersion.files } : {}),
    });
    if (currentVersion && sawReplayFallback && provider.mode !== "replay") {
      throw new Error(
        "上游模型触发演示回放降级，为避免覆盖现有版本已中止保存，请稍后重试",
      );
    }
    if (!currentVersion && engineer.files.length === 0) {
      throw new Error("Engineer returned no files for the initial version");
    }
    // Merge follow-up deltas BEFORE emitting so the client preview always
    // receives the full file set (a delta alone may omit src/main.tsx → blank screen).
    let files = currentVersion
      ? mergeFileDelta(currentVersion.files, engineer.files)
      : engineer.files;
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "engineer",
        type: "file",
        payload: {
          ...engineer,
          currentFiles: files,
          timing: stageTiming(engineerStarted),
          ...(replayLabel ? { providerLabel: replayLabel } : {}),
        },
      },
      onEvent,
    );
    let summary = engineer.summary;
    let qaRounds = 0;
    let exhausted = false;
    let qaResult: QaResult;
    let prevFailureSignature: string | null = null;

    while (true) {
      const probeStarted = Date.now();
      const [rawProbe, sandbox] = await Promise.all([
        probePreview ? probePreview(files, qaRounds) : Promise.resolve(defaultProbe(files)),
        (verifySandbox ?? verifyInBackendSandbox)(files),
      ]);
      const probe: PreviewProbeReport = sandbox.ok
        ? rawProbe
        : {
            ...rawProbe,
            compileErrors: Array.from(
              new Set([...rawProbe.compileErrors, ...sandbox.errors]),
            ),
          };
      await persistEvent(
        repo,
        {
          runId,
          seq: nextSeq(),
          agent: "qa",
          type: "probe",
          payload: {
            round: qaRounds,
            report: probe,
            sandbox,
            timing: stageTiming(probeStarted),
          },
        },
        onEvent,
      );

      const verdictStarted = Date.now();
      qaResult = await runQa(trackedProvider, { acceptance: plan.acceptance, probe });

      const unverifiedCriteria = qaResult.verdicts
        .filter(({ verdict }) => verdict === "unverified")
        .map(({ criterion }) => criterion);

      if (
        unverifiedCriteria.length > 0 &&
        !hasProbeFailure(probe) &&
        !hasQaFailure(qaResult)
      ) {
        const reviewStarted = Date.now();
        const expectedSha256 = await computeFilesSha256(files);
        const reviewPlan = await planInteractiveReview(trackedProvider, {
          unverifiedCriteria,
          probe,
          files,
        });
        const reviewReport = await (reviewSandbox ?? runInteractiveSandboxReview)(
          files,
          reviewPlan,
          expectedSha256,
        );
        if (reviewReport) {
          await persistEvent(
            repo,
            {
              runId,
              seq: nextSeq(),
              agent: "qa",
              type: "review",
              payload: {
                round: qaRounds,
                ...reviewReport,
                timing: stageTiming(reviewStarted),
              },
            },
            onEvent,
          );
          const adjudicated = await adjudicateReviewReport(trackedProvider, {
            unverifiedCriteria,
            reviewReport,
            expectedSha256,
          });
          qaResult = mergeReviewedVerdicts(qaResult, adjudicated);
        }
      }

      await persistEvent(
        repo,
        {
          runId,
          seq: nextSeq(),
          agent: "qa",
          type: "verdict",
          payload: {
            round: qaRounds,
            ...qaResult,
            timing: stageTiming(verdictStarted),
          },
        },
        onEvent,
      );

      const needsRepair = hasProbeFailure(probe) || hasQaFailure(qaResult);
      if (!needsRepair) break;

      const failureSignature = JSON.stringify({
        compile: probe.compileErrors,
        runtime: probe.runtimeErrors,
        blank: probe.blankScreen,
        failedCriteria: qaResult.verdicts
          .filter((v) => v.verdict === "fail")
          .map((v) => v.criterion)
          .sort(),
      });
      const stalled =
        qaRounds > 0 &&
        prevFailureSignature !== null &&
        failureSignature === prevFailureSignature &&
        !hasProbeFailure(probe);
      prevFailureSignature = failureSignature;

      if (stalled) {
        exhausted = true;
        await persistEvent(
          repo,
          {
            runId,
            seq: nextSeq(),
            agent: "qa",
            type: "fix",
            payload: {
              round: qaRounds,
              exhausted: true,
              messageZh: "连续两轮判定无变化，已停止自动重试，可直接在下方补充需求继续修改",
              qa_score: qaResult.qa_score,
            },
          },
          onEvent,
        );
        break;
      }
      const fixInstruction =
        qaResult.fixInstruction ??
        (hasProbeFailure(probe)
          ? `修复预览错误：${[...probe.compileErrors, ...probe.runtimeErrors].join("；") || "页面为空"}`
          : qaResult.verdicts
              .filter(({ verdict }) => verdict === "fail")
              .map(({ criterion, reason }) => `${criterion}：${reason}`)
              .join("；"));
      if (qaRounds >= MAX_FIX_ROUNDS) {
        exhausted = true;
        await persistEvent(
          repo,
          {
            runId,
            seq: nextSeq(),
            agent: "qa",
            type: "fix",
            payload: {
              round: qaRounds,
              exhausted: true,
              messageZh: "已达修复上限",
              qa_score: qaResult.qa_score,
            },
          },
          onEvent,
        );
        break;
      }

      qaRounds += 1;
      await repo.updateRun(runId, { qaRounds, qaScore: qaResult.qa_score });
      const repairStarted = Date.now();
      const repair = await runEngineerRepair(trackedProvider, {
        prompt,
        plan,
        design,
        currentFiles: files,
        fixInstruction,
      });
      files = mergeFileDelta(files, repair.files);
      summary = repair.summary;
      await persistEvent(
        repo,
        {
          runId,
          seq: nextSeq(),
          agent: "qa",
          type: "fix",
          payload: {
            round: qaRounds,
            fixInstruction,
            files: repair.files.map(({ path }) => path),
            currentFiles: files,
            timing: stageTiming(repairStarted),
          },
        },
        onEvent,
      );
    }

    const version = engineer.files.length === 0 && currentVersion
      ? null
      : await repo.createVersion({
          projectId,
          runId,
          files,
          acceptance: plan.acceptance,
          summary,
          qaScore: qaResult.qa_score,
          parentId: currentVersion?.id ?? null,
        });
    if (version) await repo.setCurrentVersion(projectId, version.id);
    const versionId = version?.id ?? currentVersion?.id;
    if (!versionId) throw new Error("Pipeline completed without a version snapshot");
    await repo.addMessage({ projectId, role: "agent", content: summary });
    await repo.updateRun(runId, {
      status: "completed",
      finishedAt: new Date(),
      qaRounds,
      qaScore: qaResult.qa_score,
      tokensIn,
      tokensOut,
    });
    await chargeUsage(false);

    return {
      plan,
      files,
      versionId,
      summary,
      qaScore: qaResult.qa_score,
      qaRounds,
      exhausted,
    };
  } catch (error) {
    const isAbort =
      error instanceof DOMException && error.name === "AbortError";
    if (isAbort) {
      await repo.updateRun(runId, {
        status: "interrupted",
        finishedAt: new Date(),
      });
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    const hasChineseMessage = /[\u4e00-\u9fff]/.test(detail);
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "engineer",
        type: "error",
        payload: {
          messageZh: hasChineseMessage ? detail : "生成失败，请稍后重试或点击继续",
          detail,
        },
      },
      onEvent,
    ).catch(() => undefined);

    await repo.updateRun(runId, {
      status: "failed",
      finishedAt: new Date(),
      tokensIn,
      tokensOut,
    });
    await chargeUsage(true);
    throw error;
  }
}
