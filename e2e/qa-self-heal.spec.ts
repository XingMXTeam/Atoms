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

  test("recovers from the mock compile error and persists the score badge", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("触发修复演示：做一个中文待办清单");
    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });
    const completedWorkbenchUrl = page.url();

    const qaCard = page.getByTestId("agent-card-qa");
    await expect(qaCard).toHaveAttribute("data-status", "completed", {
      timeout: 45_000,
    });
    await expect(page.getByTestId("workbench-score-badge")).toContainText("100 分");

    await qaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(
      qaCard.getByText("第 0 轮 · 未通过：演示编译错误").first(),
    ).toBeVisible();
    await expect(qaCard.getByText("已由第 1 轮修复").first()).toBeVisible();
    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-status",
      "ready",
    );
    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-painted",
      "true",
    );
    await expect(page.getByTestId("preview-paint-probe")).toContainText("我的待办");
    await page.getByRole("tab", { name: "代码" }).click();
    await expect(page.getByTestId("code-pane")).toContainText("预览已修复");

    await page.goto(completedWorkbenchUrl);
    const persistedRecoveryScore = page.getByTestId("workbench-score-badge");
    await expect(persistedRecoveryScore).toHaveText("100 分");
    await expect(persistedRecoveryScore).toHaveAttribute("data-run-qa-score", "100");
    await expect(persistedRecoveryScore).toHaveAttribute("data-version-qa-score", "100");
    await expect(persistedRecoveryScore).toHaveAttribute("data-version-id", /.+/);
    await expect(persistedRecoveryScore).toHaveAttribute(
      "data-version-run-id",
      await persistedRecoveryScore.getAttribute("data-run-id") ?? "",
    );
    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-painted",
      "true",
    );

    await page.getByRole("link", { name: "返回首页" }).click();
    const projectCard = page.getByRole("link", { name: /中文待办清单/ });
    await expect(projectCard.getByTestId("project-score-badge")).toHaveText("100 分");
    await page.reload();
    await expect(
      projectCard.getByTestId("project-score-badge"),
    ).toHaveText("100 分");
  });

  test("shows exhaustion after three repairs and keeps the persisted score", async ({
    page,
  }) => {
    await page.goto("/");
    // Mock control: prefix with MOCK_PERSISTENT_FAILURE_TRIGGER (持续失败演示)
    // to retain the compile error through all three repair rounds.
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("持续失败演示：做一个中文待办清单");
    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });
    const completedWorkbenchUrl = page.url();

    const qaCard = page.getByTestId("agent-card-qa");
    await expect(qaCard).toHaveAttribute("data-status", "completed", {
      timeout: 45_000,
    });
    await expect(page.getByTestId("workbench-score-badge")).toHaveText("0 分");
    await qaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(qaCard.getByText("已达修复上限（第 3 轮）").first()).toBeVisible();
    await expect(qaCard.getByText("修复 · 第 1 轮")).toBeVisible();
    await expect(qaCard.getByText("修复 · 第 2 轮")).toBeVisible();
    await expect(qaCard.getByText("修复 · 第 3 轮")).toBeVisible();
    await expect(qaCard.getByText("修复上限 · 第 3 轮")).toBeVisible();

    await page.goto(completedWorkbenchUrl);
    const persistedFailureScore = page.getByTestId("workbench-score-badge");
    await expect(persistedFailureScore).toHaveText("0 分");
    await expect(persistedFailureScore).toHaveAttribute("data-run-qa-rounds", "3");
    await expect(persistedFailureScore).toHaveAttribute("data-run-qa-score", "0");
    await expect(persistedFailureScore).toHaveAttribute("data-version-qa-score", "0");
    await expect(persistedFailureScore).toHaveAttribute("data-version-id", /.+/);
    await expect(persistedFailureScore).toHaveAttribute(
      "data-version-run-id",
      await persistedFailureScore.getAttribute("data-run-id") ?? "",
    );
    const persistedQaCard = page.getByTestId("agent-card-qa");
    await persistedQaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(persistedQaCard.getByText("已达修复上限（第 3 轮）").first()).toBeVisible();

    await page.getByRole("link", { name: "返回首页" }).click();
    const projectCard = page.getByRole("link", { name: /中文待办清单/ });
    await expect(projectCard).toBeVisible();
    await page.reload();
    await expect(projectCard.getByTestId("project-score-badge")).toHaveText("0 分");
  });
});
