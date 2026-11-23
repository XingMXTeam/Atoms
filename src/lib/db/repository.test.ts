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
