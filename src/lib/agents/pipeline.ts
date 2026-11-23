import type { AppRepository } from "@/lib/db/repository";
import type { LlmProvider } from "@/lib/llm/types";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import { runArchitect } from "./architect";
import { runEngineer, runEngineerRepair } from "./engineer";
import { runQa, type QaResult } from "./qa";
import {
  createSeqCounter,
  type AgentEventRecord,
} from "./events";
import type { GeneratedFile, PlannerPayload } from "./fixtures";
import { runPlanner } from "./planner";

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
  onEvent?: (event: AgentEventRecord) => void | Promise<void>;
  /** When true, skip marking the run failed on error (caller handles). */
  signal?: AbortSignal;
  /** Test-only delay between stages so e2e can force an SSE disconnect (REQ-9). */
  stageDelayMs?: number;
  /** Preview host callback; each repair is judged against a fresh report. */
  probePreview?: (files: GeneratedFile[]) => Promise<PreviewProbeReport>;
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

function mergeFileDelta(
  currentFiles: GeneratedFile[],
  deltaFiles: GeneratedFile[],
): GeneratedFile[] {
  const merged = new Map(currentFiles.map((file) => [file.path, file]));
  for (const file of deltaFiles) merged.set(file.path, file);
  return [...merged.values()];
}

function defaultProbe(files: GeneratedFile[]): PreviewProbeReport {
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
    onEvent,
    signal,
    stageDelayMs,
    probePreview,
  } = options;
  const nextSeq = createSeqCounter();

  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const plan = await runPlanner(provider, prompt);
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "planner",
        type: "plan",
        payload: plan,
      },
      onEvent,
    );

    // Prefer Planner title for the project list after generation.
    await repo.updateProjectTitle(projectId, plan.title);

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const design = await runArchitect(provider, { prompt, plan });
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "architect",
        type: "design",
        payload: design,
      },
      onEvent,
    );

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await delayStage(stageDelayMs, signal);
    const engineer = await runEngineer(provider, { prompt, plan, design });
    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "engineer",
        type: "file",
        payload: engineer,
      },
      onEvent,
    );

    let files = engineer.files;
    let summary = engineer.summary;
    let qaRounds = 0;
    let exhausted = false;
    let qaResult: QaResult;

    while (true) {
      const probe = probePreview ? await probePreview(files) : defaultProbe(files);
      await persistEvent(
        repo,
        {
          runId,
          seq: nextSeq(),
          agent: "qa",
          type: "probe",
          payload: { round: qaRounds, report: probe },
        },
        onEvent,
      );

      qaResult = await runQa(provider, { acceptance: plan.acceptance, probe });
      await persistEvent(
        repo,
        {
          runId,
          seq: nextSeq(),
          agent: "qa",
          type: "verdict",
          payload: { round: qaRounds, ...qaResult },
        },
        onEvent,
      );

      const needsRepair = hasProbeFailure(probe) || hasQaFailure(qaResult);
      if (!needsRepair) break;
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
      const repair = await runEngineerRepair(provider, {
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
          },
        },
        onEvent,
      );
    }

    const version = await repo.createVersion({
      projectId,
      runId,
      files,
      acceptance: plan.acceptance,
      summary,
      qaScore: qaResult.qa_score,
    });
    await repo.setCurrentVersion(projectId, version.id);
    await repo.addMessage({ projectId, role: "agent", content: summary });
    await repo.updateRun(runId, {
      status: "completed",
      finishedAt: new Date(),
      qaRounds,
      qaScore: qaResult.qa_score,
    });

    return {
      plan,
      files,
      versionId: version.id,
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

    await persistEvent(
      repo,
      {
        runId,
        seq: nextSeq(),
        agent: "engineer",
        type: "error",
        payload: {
          messageZh: "生成失败，请稍后重试或点击继续",
          detail: error instanceof Error ? error.message : String(error),
        },
      },
      onEvent,
    ).catch(() => undefined);

    await repo.updateRun(runId, {
      status: "failed",
      finishedAt: new Date(),
    });
    throw error;
  }
}
