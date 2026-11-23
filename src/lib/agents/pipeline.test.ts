/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "@/lib/db/adapters/sqlite";
import { createLlmProvider } from "@/lib/llm/provider";
import { runAgentPipeline } from "./pipeline";
import { MOCK_ENGINEER_FILES } from "./fixtures";

describe("agent pipeline (REQ-3 / REQ-7 / REQ-8)", () => {
  it("emits Planner → Architect → Engineer events with monotonic seq and persists version", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "待办",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    const emitted: Array<{ agent: string; type: string; seq: number }> = [];
    const provider = createLlmProvider({ mode: "mock" });

    const result = await runAgentPipeline({
      repo,
      provider,
      projectId: project.id,
      runId: run.id,
      prompt: "做一个待办清单",
      onEvent: (event) => {
        emitted.push({
          agent: event.agent,
          type: event.type,
          seq: event.seq,
        });
      },
    });

    expect(emitted.map((e) => e.agent)).toEqual([
      "planner",
      "architect",
      "engineer",
    ]);
    expect(emitted.map((e) => e.type)).toEqual(["plan", "design", "file"]);
    expect(emitted.map((e) => e.seq)).toEqual([1, 2, 3]);

    const stored = await repo.listAgentEvents(run.id);
    expect(stored.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(stored[0]?.agent).toBe("planner");
    expect(stored[1]?.agent).toBe("architect");
    expect(stored[2]?.agent).toBe("engineer");

    expect(result.files).toEqual(MOCK_ENGINEER_FILES);
    expect(result.versionId).toBeTruthy();

    const refreshed = await repo.getProject(project.id, "device-a");
    expect(refreshed?.currentVersionId).toBe(result.versionId);

    const updatedRun = await repo.getRun(run.id);
    expect(updatedRun?.status).toBe("completed");
    expect(updatedRun?.finishedAt).toBeInstanceOf(Date);
  });

  it("retries structured parse once on failure then succeeds", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "重试",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    let engineerCalls = 0;
    const provider = {
      mode: "mock" as const,
      async complete(input: { stage?: string }) {
        if (input.stage === "engineer") {
          engineerCalls += 1;
          if (engineerCalls === 1) {
            return {
              text: "not-json",
              meta: { mode: "mock" as const },
            };
          }
        }
        return createLlmProvider({ mode: "mock" }).complete(input);
      },
    };

    const result = await runAgentPipeline({
      repo,
      provider,
      projectId: project.id,
      runId: run.id,
      prompt: "做一个计算器",
    });

    expect(engineerCalls).toBe(2);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("marks run interrupted when the abort signal fires (REQ-9)", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "中断",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    const abort = new AbortController();
    const provider = {
      mode: "mock" as const,
      async complete() {
        abort.abort();
        await new Promise((resolve) => setTimeout(resolve, 10));
        return createLlmProvider({ mode: "mock" }).complete({
          stage: "planner",
        });
      },
    };

    await expect(
      runAgentPipeline({
        repo,
        provider,
        projectId: project.id,
        runId: run.id,
        prompt: "做一个会中断的应用",
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    const updated = await repo.getRun(run.id);
    expect(updated?.status).toBe("interrupted");
    expect(updated?.finishedAt).toBeInstanceOf(Date);
  });
});
