import type { AppRepository } from "@/lib/db/repository";
import type { LlmProvider } from "@/lib/llm/types";
import { runArchitect } from "./architect";
import { runEngineer } from "./engineer";
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
};

async function persistEvent(
  repo: AppRepository,
  input: Omit<AgentEventRecord, "id">,
  onEvent?: RunAgentPipelineOptions["onEvent"],
): Promise<AgentEventRecord> {
  const event = await repo.appendAgentEvent(input);
  await onEvent?.(event);
  return event;
}

export async function runAgentPipeline(
  options: RunAgentPipelineOptions,
): Promise<PipelineResult> {
  const { repo, provider, projectId, runId, prompt, onEvent, signal } = options;
  const nextSeq = createSeqCounter();

  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

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

    const version = await repo.createVersion({
      projectId,
      runId,
      files: engineer.files,
      acceptance: plan.acceptance,
      summary: engineer.summary,
    });
    await repo.setCurrentVersion(projectId, version.id);
    await repo.addMessage({
      projectId,
      role: "agent",
      content: engineer.summary,
    });
    await repo.updateRun(runId, {
      status: "completed",
      finishedAt: new Date(),
    });

    return {
      plan,
      files: engineer.files,
      versionId: version.id,
      summary: engineer.summary,
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
