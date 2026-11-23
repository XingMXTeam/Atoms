/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "@/lib/db/adapters/sqlite";
import { createLlmProvider } from "@/lib/llm/provider";
import { runAgentPipeline } from "./pipeline";
import { MOCK_ENGINEER_FILES } from "./fixtures";
import type { PreviewProbeReport } from "@/lib/preview/probe";

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
      "qa",
      "qa",
    ]);
    expect(emitted.map((e) => e.type)).toEqual([
      "plan",
      "design",
      "file",
      "probe",
      "verdict",
    ]);
    expect(emitted.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);

    const stored = await repo.listAgentEvents(run.id);
    expect(stored.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(stored[0]?.agent).toBe("planner");
    expect(stored[1]?.agent).toBe("architect");
    expect(stored[2]?.agent).toBe("engineer");

    expect(result.files).toEqual(MOCK_ENGINEER_FILES);
    expect(result.versionId).toBeTruthy();

    const refreshed = await repo.getProject(project.id, "device-a");
    expect(refreshed?.currentVersionId).toBe(result.versionId);

    const updatedRun = await repo.getRun(run.id);
    const persistedVersion = await repo.getVersion(result.versionId);
    expect(updatedRun?.status).toBe("completed");
    expect(updatedRun?.finishedAt).toBeInstanceOf(Date);
    expect(updatedRun?.qaScore).toBe(100);
    expect(refreshed?.qaScore).toBe(updatedRun?.qaScore);
    expect(persistedVersion?.runId).toBe(run.id);
    expect(persistedVersion?.qaScore).toBe(updatedRun?.qaScore);
  });

  it("applies only repair deltas and stops after the preview passes", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "自修复",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });
    const repairRequests: Array<Record<string, unknown>> = [];
    let probeRound = 0;
    const provider = {
      mode: "mock" as const,
      async complete(input: Record<string, unknown>) {
        if (input.stage === "planner") {
          return { text: JSON.stringify({
            title: "测试应用", prd: "修复应用", acceptance: ["显示内容"],
          }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "architect") {
          return { text: JSON.stringify({
            files: ["src/main.tsx"], components: ["App"], data: [], notes: "",
          }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "engineer-repair") {
          repairRequests.push(input);
          return { text: JSON.stringify({
            files: [{ path: "src/App.tsx", content: "export default () => <h1>修复</h1>;" }],
            summary: "修复预览错误",
          }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "engineer") {
          return { text: JSON.stringify({
            files: [
              { path: "src/main.tsx", content: "import App from './App';" },
              { path: "src/App.tsx", content: "broken source" },
            ],
            summary: "初始版本",
          }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "qa") {
          const failed = probeRound === 1;
          return { text: JSON.stringify({
            verdicts: [{ criterion: "显示内容", verdict: failed ? "fail" : "pass", reason: failed ? "语法错误" : "显示正常" }],
            ...(failed ? { fixInstruction: "修复 src/App.tsx 的语法错误" } : {}),
          }), meta: { mode: "mock" as const } };
        }
        throw new Error(`Unexpected stage: ${String(input.stage)}`);
      },
    };
    const probe: PreviewProbeReport = {
      source: "atoms-preview",
      type: "probe",
      compileErrors: [],
      runtimeErrors: [],
      blankScreen: false,
      domSummary: { title: "", text: "", elementCount: 0 },
    };

    const result = await runAgentPipeline({
      repo,
      provider,
      projectId: project.id,
      runId: run.id,
      prompt: "修复应用",
      probePreview: async () => {
        probeRound += 1;
        return probeRound === 1
          ? { ...probe, compileErrors: ["语法错误"], blankScreen: true }
          : probe;
      },
    });

    expect(repairRequests).toHaveLength(1);
    expect(repairRequests[0]).toMatchObject({
      currentFiles: [
        { path: "src/main.tsx", content: "import App from './App';" },
        { path: "src/App.tsx", content: "broken source" },
      ],
      fixInstruction: "修复 src/App.tsx 的语法错误",
    });
    expect(result.files).toEqual([
      { path: "src/main.tsx", content: "import App from './App';" },
      { path: "src/App.tsx", content: "export default () => <h1>修复</h1>;" },
    ]);
  });

  it("caps repairs at three rounds and keeps the final score and version", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "上限" });
    const run = await repo.createRun({ projectId: project.id, status: "running" });
    let repairCalls = 0;
    let qaCalls = 0;
    const provider = {
      mode: "mock" as const,
      async complete(input: Record<string, unknown>) {
        if (input.stage === "planner") {
          return { text: JSON.stringify({ title: "上限", prd: "测试页面", acceptance: ["显示内容"] }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "architect") {
          return { text: JSON.stringify({ files: ["src/App.tsx"], components: ["App"], data: [], notes: "" }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "engineer") {
          return { text: JSON.stringify({ files: [{ path: "src/App.tsx", content: "broken" }], summary: "初始" }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "engineer-repair") {
          repairCalls += 1;
          return { text: JSON.stringify({ files: [{ path: "src/App.tsx", content: `still broken ${repairCalls}` }], summary: "修复尝试" }), meta: { mode: "mock" as const } };
        }
        if (input.stage === "qa") {
          qaCalls += 1;
          return { text: JSON.stringify({
            verdicts: [{ criterion: "显示内容", verdict: "fail", reason: "预览仍为空" }],
            fixInstruction: "继续修复页面",
          }), meta: { mode: "mock" as const } };
        }
        throw new Error(`Unexpected stage: ${String(input.stage)}`);
      },
    };
    const failedProbe: PreviewProbeReport = {
      source: "atoms-preview",
      type: "probe",
      compileErrors: ["编译失败"],
      runtimeErrors: [],
      blankScreen: true,
      domSummary: { title: "", text: "", elementCount: 0 },
    };

    const result = await runAgentPipeline({
      repo,
      provider,
      projectId: project.id,
      runId: run.id,
      prompt: "修复页面",
      probePreview: async () => failedProbe,
    });

    expect(repairCalls).toBe(3);
    expect(qaCalls).toBe(4);
    expect(result).toMatchObject({ qaRounds: 3, qaScore: 0, exhausted: true });
    expect(result.versionId).toBeTruthy();
    const storedRun = await repo.getRun(run.id);
    const storedProject = await repo.getProject(project.id, "device-a");
    const storedVersion = await repo.getVersion(result.versionId);
    expect(storedRun?.qaRounds).toBe(3);
    expect(storedRun?.qaScore).toBe(0);
    expect(storedProject?.qaScore).toBe(storedRun?.qaScore);
    expect(storedVersion?.runId).toBe(run.id);
    expect(storedVersion?.qaScore).toBe(storedRun?.qaScore);
    const events = await repo.listAgentEvents(run.id);
    expect(events.filter((event) => event.type === "fix")).toHaveLength(4);
    expect(events.at(-1)?.payload).toMatchObject({ exhausted: true, messageZh: "已达修复上限" });
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
