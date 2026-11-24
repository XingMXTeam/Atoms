import { expect, test } from "@playwright/test";

test.describe("project state persistence & backend sandbox verification", () => {
  test("persists generated app tasks and completion state across full page reload without allow-same-origin", async ({
    page,
  }) => {
    await page.goto("/");

    const todoLink = page.getByRole("link", { name: /待办清单示例/ }).first();
    await expect(todoLink).toBeVisible({ timeout: 15_000 });
    await todoLink.click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15_000 });

    const iframe = page.getByTestId("preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 20_000 });
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-forms");
    await expect(page.getByTestId("preview-paint-probe")).toContainText("我的待办", {
      timeout: 20_000,
    });

    const frame = page.frameLocator('[data-testid="preview-iframe"]');
    const input = frame.getByRole("textbox").first();
    await expect(input).toBeVisible({ timeout: 10_000 });

    const savePromise = page.waitForResponse(
      (res) => res.url().includes("/state") && res.request().method() === "PUT" && res.ok(),
      { timeout: 15_000 },
    );
    await input.fill("刷新后不丢失的持久化任务");
    await frame.getByRole("button", { name: "添加待办" }).click();
    await expect(frame.getByText("刷新后不丢失的持久化任务")).toBeVisible({
      timeout: 10_000,
    });
    await savePromise;
    await expect(page.getByTestId("preview-state-sync")).toContainText("状态已持久化", {
      timeout: 10_000,
    });

    // Full page reload must restore the persisted task from D1/SQLite project_state.
    await page.reload();
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "刷新后不丢失的持久化任务",
      { timeout: 20_000 },
    );
    const reloadedFrame = page.frameLocator('[data-testid="preview-iframe"]');
    await expect(reloadedFrame.getByText("刷新后不丢失的持久化任务")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("executes backend sandbox verification during generation and renders command output in QA card", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /示例：/ }).first().click();
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15_000 });
    await expect(page.getByTestId("agent-timeline")).toHaveAttribute(
      "data-run-status",
      "completed",
      { timeout: 30_000 },
    );

    const qaCard = page.getByTestId("agent-card-qa");
    await qaCard.getByRole("button", { name: /展开质检详情/ }).click();
    const sandboxReport = qaCard.getByTestId("qa-sandbox-report");
    await expect(sandboxReport).toBeVisible({ timeout: 10_000 });
    await expect(sandboxReport).toContainText("tsc --noEmit");
    await expect(sandboxReport).toContainText("exit 0");
  });
});
