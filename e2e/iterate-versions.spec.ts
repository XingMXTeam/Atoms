import { expect, test } from "@playwright/test";

test.describe("iterate-versions workbench (REQ-2 / REQ-6)", () => {
  test("shows version metadata, restores the snapshot, and shares read-only", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个简洁的待办清单应用");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });

    await expect(page.getByTestId("agent-card-engineer").getByText("已完成"))
      .toBeVisible({ timeout: 30_000 });
    const projectId = new URL(page.url()).pathname.split("/").at(-1);
    const initialRunId = await page
      .getByTestId("workbench-score-badge")
      .getAttribute("data-run-id");
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "体验 Atoms Studio",
    );

    const followUp = await page.request.post(
      new URL(`/api/projects/${projectId}/runs/${initialRunId}/continue`, page.url()).toString(),
      { data: { prompt: "为每项待办加入优先级标签" } },
    );
    expect(followUp.ok()).toBe(true);
    const { runId } = (await followUp.json()) as { runId: string };
    await page.goto(`/projects/${projectId}?run=${runId}`);
    await expect(page.getByTestId("agent-card-engineer").getByText("已完成"))
      .toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("code-source")).toContainText("优先级");

    await page.getByRole("tab", { name: "版本" }).click();
    const timeline = page.getByTestId("version-timeline");
    await expect(timeline).toBeVisible();
    const versionRows = timeline.getByTestId("version-row");
    await expect(versionRows).toHaveCount(2);
    await expect(versionRows.first().locator("p").first()).not.toBeEmpty();
    await expect(versionRows.first().getByText(/QA \d+ 分/)).toBeVisible();
    await expect(versionRows.first().getByText("当前版本")).toBeVisible();
    const priorVersionId = await versionRows.nth(1).getAttribute("data-version-id");

    const rollbackButton = versionRows
      .nth(1)
      .getByRole("button", { name: "恢复此版本" });
    await expect(rollbackButton).toBeVisible();
    await rollbackButton.click();

    await expect(page.getByTestId("workbench-tab-preview")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("restore-status-banner")).toContainText(
      "已恢复所选版本",
    );
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "体验 Atoms Studio",
    );
    await expect(page.getByTestId("preview-paint-probe")).not.toContainText(
      "优先级",
    );

    await page.getByRole("tab", { name: "代码" }).click();
    await expect(page.getByTestId("code-source")).toContainText("体验 Atoms Studio");
    await expect(page.getByTestId("code-source")).not.toContainText("优先级");

    // Verify restored version persists across hard reload even after follow-up ?run= was in URL.
    await page.reload();
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "体验 Atoms Studio",
    );
    await expect(page.getByTestId("preview-paint-probe")).not.toContainText(
      "优先级",
    );
    await page.getByRole("tab", { name: "代码" }).click();
    await expect(page.getByTestId("code-source")).not.toContainText("优先级");
    await page.getByRole("tab", { name: "预览" }).click();

    await page.getByRole("button", { name: "创建只读分享链接" }).click();
    const shareLink = page.getByRole("link", { name: /\/share\// });
    await expect(shareLink).toBeVisible();
    const shareUrl = await shareLink.getAttribute("href");
    expect(shareUrl).toMatch(/^\/share\/[A-Za-z0-9_-]{43}$/);

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(shareUrl!);
    await expect(visitorPage.getByText("只读分享")).toBeVisible();
    await expect(visitorPage.getByTestId("preview-pane")).toBeVisible();
    await expect(
      visitorPage.getByRole("button", { name: "恢复此版本" }),
    ).toHaveCount(0);
    await visitorPage.getByRole("tab", { name: "代码" }).click();
    await expect(visitorPage.getByTestId("code-source")).not.toBeEmpty();

    const deniedMutation = await visitorPage.request.post(
      new URL(`/api/projects/${projectId}/versions`, page.url()).toString(),
      { data: { versionId: priorVersionId } },
    );
    expect([401, 403]).toContain(deniedMutation.status());
    await visitorContext.close();
  });

  test("shows completed examples with QA scores for a fresh device", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");

    const projects = page.getByRole("region", { name: "我的项目" });
    await expect(projects.getByTestId("project-score-badge")).toHaveCount(2);
    await expect(projects.getByRole("link")).toHaveCount(2);

    await context.close();
  });
});
