/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "./adapters/sqlite";

describe("AppRepository events/versions (REQ-3 / REQ-7)", () => {
  it("appendAgentEvent assigns ids and listAgentEvents returns monotonic seq", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "事件项目",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    const first = await repo.appendAgentEvent({
      runId: run.id,
      seq: 1,
      agent: "planner",
      type: "plan",
      payload: { title: "迷你 PRD", acceptance: ["AC-1"] },
    });
    const second = await repo.appendAgentEvent({
      runId: run.id,
      seq: 2,
      agent: "architect",
      type: "design",
      payload: { components: ["App"] },
    });

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);

    const listed = await repo.listAgentEvents(run.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((e) => e.seq)).toEqual([1, 2]);
    expect(listed[0]?.payload).toEqual({
      title: "迷你 PRD",
      acceptance: ["AC-1"],
    });
  });

  it("createVersion + setCurrentVersion updates project pointer", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "版本项目",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    const files = [
      { path: "src/App.tsx", content: "export default function App() { return <div>你好</div>; }" },
    ];
    const acceptance = ["AC-1 显示中文标题"];

    const version = await repo.createVersion({
      projectId: project.id,
      runId: run.id,
      files,
      acceptance,
      summary: "首版待办应用",
      qaScore: 85,
    });

    expect(version.id).toBeTruthy();
    expect(version.files).toEqual(files);
    expect(version.acceptance).toEqual(acceptance);
    expect(version.summary).toBe("首版待办应用");

    await repo.setCurrentVersion(project.id, version.id);
    const refreshed = await repo.getProject(project.id, "device-a");
    expect(refreshed?.currentVersionId).toBe(version.id);
    expect(refreshed?.qaScore).toBe(85);
  });

  it("getRun returns the run by id", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "运行查询",
    });
    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });

    const found = await repo.getRun(run.id);
    expect(found).toEqual(run);
    expect(await repo.getRun("missing")).toBeNull();
  });
});
