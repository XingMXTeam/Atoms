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

  it("preserves project title, forwards history on follow-up, and aborts before overwriting on replay fallback", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "精美待办清单" });
    const v1Run = await repo.createRun({ projectId: project.id, status: "completed" });
    const v1Files = [{ path: "src/App.tsx", content: "export default () => <div>Styled UI</div>;" }];
    const v1 = await repo.createVersion({
      projectId: project.id,
      runId: v1Run.id,
      files: v1Files,
      acceptance: ["AC-1"],
      summary: "V1 UI",
      qaScore: 100,
    });
    await repo.setCurrentVersion(project.id, v1.id);

    const run2 = await repo.createRun({ projectId: project.id, status: "running" });
    const seenPlannerInputs: Array<Record<string, unknown>> = [];
    const seenArchitectInputs: Array<Record<string, unknown>> = [];
    const replayOnFollowUp = {
      mode: "gemini" as const,
      async complete(input: Record<string, unknown>) {
        if (input.stage === "planner") {
          seenPlannerInputs.push(input);
          return {
            text: JSON.stringify({ title: "新标题覆盖尝试", prd: "修复按钮", acceptance: ["AC-1"] }),
            meta: { mode: "gemini" as const },
          };
        }
        if (input.stage === "architect") {
          seenArchitectInputs.push(input);
          return {
            text: JSON.stringify({ files: ["src/App.tsx"], components: ["App"], data: [], notes: "" }),
            meta: { mode: "gemini" as const },
          };
        }
        if (input.stage === "engineer") {
          return {
            text: JSON.stringify({ files: [{ path: "src/App.tsx", content: "skeleton" }], summary: "演示回放" }),
            meta: { mode: "replay" as const, label: "演示回放" as const },
          };
        }
        throw new Error(`Unexpected stage: ${String(input.stage)}`);
      },
    };

    const history = [
      { role: "user" as const, content: "做一个待办" },
      { role: "user" as const, content: "点击添加没反应" },
    ];

    await expect(
      runAgentPipeline({
        repo,
        provider: replayOnFollowUp,
        projectId: project.id,
        runId: run2.id,
        prompt: "点击添加没反应",
        history,
        currentVersion: { id: v1.id, files: v1Files },
      }),
    ).rejects.toThrow(/演示回放降级/);

    expect(seenPlannerInputs[0]).toMatchObject({ history, currentFiles: v1Files });
    expect(seenArchitectInputs[0]).toMatchObject({ history, currentFiles: v1Files });
    const afterProject = await repo.getProject(project.id, "device-a");
    expect(afterProject?.title).toBe("精美待办清单");
    expect(afterProject?.currentVersionId).toBe(v1.id);
    expect(await repo.listVersions(project.id)).toHaveLength(1);
    const failedRun = await repo.getRun(run2.id);
    expect(failedRun?.status).toBe("failed");
  });

  it("tags initial-run SSE events with providerLabel when replay fallback triggers", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "新项目" });
    const run = await repo.createRun({ projectId: project.id, status: "running" });
    const emitted: Array<{ agent: string; payload: unknown }> = [];

    const fallbackProvider = {
      mode: "gemini" as const,
      async complete(input: Record<string, unknown>) {
        if (input.stage === "planner") {
          return {
            text: JSON.stringify({ title: "回放项目", prd: "demo", acceptance: ["AC-1"] }),
            meta: { mode: "replay" as const, label: "演示回放" as const },
          };
        }
        return createLlmProvider({ mode: "replay" }).complete(input);
      },
    };

    await runAgentPipeline({
      repo,
      provider: fallbackProvider,
      projectId: project.id,
      runId: run.id,
      prompt: "做一个待办",
      onEvent: (event) => {
        emitted.push({ agent: event.agent, payload: event.payload });
      },
    });

    const engineerEvent = emitted.find((item) => item.agent === "engineer");
    expect((engineerEvent?.payload as { providerLabel?: string } | null)?.providerLabel).toBe("演示回放");
  });

  it("accumulates Gemini token usage onto run + device/global totals and forwards probe round", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-tok", title: "计费测试" });
    const run = await repo.createRun({ projectId: project.id, status: "running" });
    const seenRounds: number[] = [];

    const meteredProvider = {
      mode: "mock" as const,
      async complete(input: Record<string, unknown>) {
        const base = await createLlmProvider({ mode: "mock" }).complete(input);
        return {
          ...base,
          meta: {
            ...base.meta,
            usage: { tokensIn: 100, tokensOut: 25 },
          },
        };
      },
    };

    const result = await runAgentPipeline({
      repo,
      provider: meteredProvider,
      projectId: project.id,
      runId: run.id,
      deviceId: "device-tok",
      prompt: "做一个中文待办清单",
      probePreview: async (files, round) => {
        seenRounds.push(round);
        return {
          source: "atoms-preview",
          type: "probe",
          compileErrors: [],
          runtimeErrors: [],
          blankScreen: false,
          domSummary: { title: "", text: `${files.length} files`, elementCount: 5 },
        };
      },
    });

    expect(result.qaScore).toBe(100);
    expect(seenRounds).toEqual([0]);
    const savedRun = await repo.getRun(run.id);
    expect(savedRun?.tokensIn).toBe(400);
    expect(savedRun?.tokensOut).toBe(100);
    const today = new Date().toISOString().slice(0, 10);
    const deviceUsage = await repo.getUsage("device-tok", today);
    expect(deviceUsage?.tokens).toBe(500);
    expect(await repo.getGlobalTokens(today)).toBe(500);
  });

  it("emits the merged full file set on follow-up engineer events so preview never loses main.tsx", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "待办" });
    const v1Run = await repo.createRun({ projectId: project.id, status: "completed" });
    const v1Files = [
      { path: "src/main.tsx", content: "import App from './App';" },
      { path: "src/App.tsx", content: "export default () => <div>V1</div>;" },
    ];
    const v1 = await repo.createVersion({
      projectId: project.id,
      runId: v1Run.id,
      files: v1Files,
      acceptance: ["AC-1"],
      summary: "V1",
      qaScore: 100,
    });
    await repo.setCurrentVersion(project.id, v1.id);
    const run2 = await repo.createRun({ projectId: project.id, status: "running" });
    const emitted: Array<{ agent: string; type: string; payload: unknown }> = [];

    const deltaProvider = {
      mode: "gemini" as const,
      async complete(input: Record<string, unknown>) {
        if (input.stage === "planner") {
          return { text: JSON.stringify({ title: "优化", prd: "优化 UI", acceptance: ["AC-1"] }), meta: { mode: "gemini" as const } };
        }
        if (input.stage === "architect") {
          return { text: JSON.stringify({ files: ["src/App.tsx"], components: ["App"], data: [], notes: "" }), meta: { mode: "gemini" as const } };
        }
        if (input.stage === "engineer") {
          // Delta only: omits unchanged src/main.tsx.
          return { text: JSON.stringify({ files: [{ path: "src/App.tsx", content: "export default () => <div>V2</div>;" }], summary: "优化 UI" }), meta: { mode: "gemini" as const } };
        }
        if (input.stage === "qa") {
          return { text: JSON.stringify({ verdicts: [{ criterion: "AC-1", verdict: "pass", reason: "ok" }] }), meta: { mode: "gemini" as const } };
        }
        throw new Error(`Unexpected stage: ${String(input.stage)}`);
      },
    };

    await runAgentPipeline({
      repo,
      provider: deltaProvider,
      projectId: project.id,
      runId: run2.id,
      prompt: "优化下UI界面",
      currentVersion: { id: v1.id, files: v1Files },
      onEvent: (event) => {
        emitted.push({ agent: event.agent, type: event.type, payload: event.payload });
      },
    });

    const engineerEvent = emitted.find((e) => e.agent === "engineer" && e.type === "file");
    const payload = engineerEvent?.payload as { currentFiles?: Array<{ path: string; content: string }> };
    expect(payload.currentFiles).toEqual([
      { path: "src/main.tsx", content: "import App from './App';" },
      { path: "src/App.tsx", content: "export default () => <div>V2</div>;" },
    ]);
  });
});
