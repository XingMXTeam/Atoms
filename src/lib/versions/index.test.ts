import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "@/lib/db/adapters/sqlite";
import { runAgentPipeline } from "@/lib/agents/pipeline";
import type { LlmProvider } from "@/lib/llm/types";
import { mergeFileDelta } from "./index";

function iterationProvider(deltaFiles: Array<{ path: string; content: string }>) {
  return {
    mode: "mock" as const,
    async complete(input: Record<string, unknown>) {
      switch (input.stage) {
        case "planner":
          return { text: JSON.stringify({ title: "测试项目", prd: "更新页面", acceptance: ["显示内容"] }), meta: { mode: "mock" as const } };
        case "architect":
          return { text: JSON.stringify({ files: ["src/App.tsx"], components: ["App"], data: [], notes: "" }), meta: { mode: "mock" as const } };
        case "engineer":
          return { text: JSON.stringify({ files: deltaFiles, summary: "更新版本" }), meta: { mode: "mock" as const } };
        case "qa":
          return { text: JSON.stringify({ verdicts: [{ criterion: "显示内容", verdict: "pass", reason: "内容正常" }] }), meta: { mode: "mock" as const } };
        default:
          throw new Error(`Unexpected stage: ${String(input.stage)}`);
      }
    },
  } satisfies LlmProvider;
}


describe("version snapshots", () => {
  it("persists a complete child snapshot with its parent while preserving history", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "测试项目" });
    const initialRun = await repo.createRun({ projectId: project.id, status: "completed" });
    const parentFiles = [
      { path: "src/App.tsx", content: "old app" },
      { path: "src/styles.css", content: "styles" },
    ];
    const parent = await repo.createVersion({
      projectId: project.id,
      runId: initialRun.id,
      files: parentFiles,
      acceptance: ["显示内容"],
      summary: "初始版本",
      qaScore: 100,
    });
    await repo.setCurrentVersion(project.id, parent.id);

    const run = await repo.createRun({ projectId: project.id, status: "running" });
    const provider = iterationProvider([
      { path: "src/App.tsx", content: "new app" },
      { path: "src/page.tsx", content: "new page" },
    ]);
    let engineerInput: Record<string, unknown> | undefined;
    const capturingProvider: LlmProvider = {
      ...provider,
      async complete(input) {
        const record = input as Record<string, unknown>;
        if (record.stage === "engineer") engineerInput = record;
        return provider.complete(record);
      },
    };

    const result = await runAgentPipeline({
      repo,
      provider: capturingProvider,
      projectId: project.id,
      runId: run.id,
      prompt: "更新页面",
      currentVersion: { id: parent.id, files: parentFiles },
    });

    const child = await repo.getVersion(result.versionId);
    expect(engineerInput?.currentFiles).toEqual(parentFiles);
    expect(child).toMatchObject({
      parentId: parent.id,
      files: [
        { path: "src/App.tsx", content: "new app" },
        { path: "src/styles.css", content: "styles" },
        { path: "src/page.tsx", content: "new page" },
      ],
    });
    expect(await repo.getVersion(parent.id)).toMatchObject({ files: parentFiles, parentId: null });
    expect((await repo.getProject(project.id, "device-a"))?.currentVersionId).toBe(child?.id);
  });

  it("leaves the current version unchanged when an iteration has no file delta", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "测试项目" });
    const initialRun = await repo.createRun({ projectId: project.id, status: "completed" });
    const files = [{ path: "src/App.tsx", content: "existing app" }];
    const parent = await repo.createVersion({
      projectId: project.id,
      runId: initialRun.id,
      files,
      acceptance: ["显示内容"],
      summary: "初始版本",
    });
    await repo.setCurrentVersion(project.id, parent.id);
    const run = await repo.createRun({ projectId: project.id, status: "running" });

    const result = await runAgentPipeline({
      repo,
      provider: iterationProvider([{ path: "src/App.tsx", content: "existing app" }]),
      projectId: project.id,
      runId: run.id,
      prompt: "没有变化",
      currentVersion: { id: parent.id, files },
    });

    expect(result.versionId).toBe(parent.id);
    expect(await repo.getVersion(parent.id)).toMatchObject({ parentId: null, files });
    expect((await repo.getProject(project.id, "device-a"))?.currentVersionId).toBe(parent.id);
  });

  it("applies changed files by path without mutating the parent snapshot", () => {
    const parent = [
      { path: "src/App.tsx", content: "old app" },
      { path: "src/styles.css", content: "styles" },
    ];
    const delta = [
      { path: "src/App.tsx", content: "new app" },
      { path: "src/page.tsx", content: "new page" },
    ];

    expect(mergeFileDelta(parent, delta)).toEqual([
      { path: "src/App.tsx", content: "new app" },
      { path: "src/styles.css", content: "styles" },
      { path: "src/page.tsx", content: "new page" },
    ]);
    expect(parent).toEqual([
      { path: "src/App.tsx", content: "old app" },
      { path: "src/styles.css", content: "styles" },
    ]);
  });
});
