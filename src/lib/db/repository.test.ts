/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "./adapters/sqlite";

describe("AppRepository (sqlite)", () => {
  it("createProject / getProject round-trip scoped by deviceId", async () => {
    const repo = createSqliteRepository(":memory:");

    const created = await repo.createProject({
      deviceId: "device-a",
      title: "示例项目",
    });

    expect(created.id).toBeTruthy();
    expect(created.deviceId).toBe("device-a");
    expect(created.title).toBe("示例项目");
    expect(created.currentVersionId).toBeNull();
    expect(created.shareSlug).toBeNull();

    const found = await repo.getProject(created.id, "device-a");
    expect(found).toEqual(created);

    const otherDevice = await repo.getProject(created.id, "device-b");
    expect(otherDevice).toBeNull();
  });

  it("stores a reusable share slug and resolves the shared project", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "分享项目",
    });
    const run = await repo.createRun({ projectId: project.id, status: "completed" });
    const version = await repo.createVersion({
      projectId: project.id,
      runId: run.id,
      files: [{ path: "src/app.tsx", content: "export default 1" }],
      acceptance: [],
      summary: "初始版本",
      qaScore: 92,
    });
    await repo.setCurrentVersion(project.id, version.id);

    expect(await repo.ensureShareSlug(project.id, "opaque-slug")).toBe("opaque-slug");
    expect(await repo.ensureShareSlug(project.id, "another-slug")).toBe("opaque-slug");
    const shared = await repo.getProjectByShareSlug("opaque-slug");
    expect(shared).toMatchObject({ id: project.id, title: "分享项目" });
    expect(await repo.getVersion(shared!.currentVersionId!)).toEqual(version);
    expect(await repo.getProjectByShareSlug("missing-slug")).toBeNull();
  });

  it("listProjects returns only this device's projects", async () => {
    const repo = createSqliteRepository(":memory:");

    const first = await repo.createProject({
      deviceId: "device-a",
      title: "旧项目",
    });
    // Ensure a later updatedAt so newest-first ordering is observable.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.createProject({
      deviceId: "device-a",
      title: "新项目",
    });
    await repo.createProject({
      deviceId: "device-b",
      title: "别人的项目",
    });

    const listed = await repo.listProjects("device-a");
    expect(listed).toHaveLength(2);
    expect(listed.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it("seeds two completed example projects once for an empty device", async () => {
    const repo = createSqliteRepository(":memory:");

    await repo.ensureSeedProjects("device-a");
    const seeded = await repo.listProjects("device-a");

    expect(seeded).toHaveLength(2);
    expect(seeded.every((project) => project.currentVersionId !== null)).toBe(true);
    expect(seeded.every((project) => project.qaScore !== null)).toBe(true);
    for (const project of seeded) {
      const version = await repo.getVersion(project.currentVersionId!);
      expect(version).toMatchObject({
        projectId: project.id,
        parentId: null,
        qaScore: expect.any(Number),
        summary: expect.any(String),
      });
      expect(version?.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "src/App.tsx", content: expect.any(String) }),
      ]));
    }

    await repo.ensureSeedProjects("device-a");
    expect(await repo.listProjects("device-a")).toHaveLength(2);
    expect(await repo.listProjects("device-b")).toHaveLength(0);
  });

  it("does not add seed projects when a device already has a project", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-a", title: "已有项目" });

    await repo.ensureSeedProjects("device-a");

    expect(await repo.listProjects("device-a")).toEqual([project]);
  });

  it("createRun / addMessage persist for a project", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({
      deviceId: "device-a",
      title: "运行项目",
    });

    const run = await repo.createRun({
      projectId: project.id,
      status: "running",
    });
    expect(run.projectId).toBe(project.id);
    expect(run.status).toBe("running");
    expect(run.finishedAt).toBeNull();

    const message = await repo.addMessage({
      projectId: project.id,
      role: "user",
      content: "做一个待办清单",
    });
    expect(message.projectId).toBe(project.id);
    expect(message.role).toBe("user");
    expect(message.content).toBe("做一个待办清单");
  });

  it("incrementUsage / getUsage accumulates runs and tokens", async () => {
    const repo = createSqliteRepository(":memory:");

    const first = await repo.incrementUsage("device-a", "2026-11-23", {
      runs: 1,
      tokens: 100,
    });
    expect(first).toMatchObject({
      deviceId: "device-a",
      day: "2026-11-23",
      runs: 1,
      tokens: 100,
    });

    const second = await repo.incrementUsage("device-a", "2026-11-23", {
      runs: 2,
      tokens: 50,
    });
    expect(second.runs).toBe(3);
    expect(second.tokens).toBe(150);

    const row = await repo.getUsage("device-a", "2026-11-23");
    expect(row).toEqual(second);

    expect(await repo.getUsage("device-a", "2026-11-22")).toBeNull();
  });
});
