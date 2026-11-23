import { expect, test } from "@playwright/test";

test.describe("QA timeline (REQ-4 / REQ-6)", () => {
  test("streams persisted probe and verdict events into expandable criterion history", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个中文待办清单");
    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });

    const timeline = page.getByTestId("agent-timeline");
    const qaCard = page.getByTestId("agent-card-qa");
    await expect(qaCard).toBeVisible({ timeout: 20_000 });
    await expect(qaCard).toHaveAttribute("data-status", "completed", {
      timeout: 30_000,
    });
    await expect(timeline).toHaveAttribute("data-run-status", "completed", {
      timeout: 15_000,
    });

    await qaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(qaCard.getByText("探测 · 第 0 轮")).toBeVisible();
    await expect(qaCard.getByText("判定 · 第 0 轮")).toBeVisible();
    await expect(
      qaCard.getByText("AC-1 页面显示标题「我的待办」"),
    ).toBeVisible();
    await expect(qaCard.getByText("第 0 轮通过").first()).toBeVisible();
    await expect(qaCard.getByText("预览正常显示").first()).toBeVisible();
  });
});
