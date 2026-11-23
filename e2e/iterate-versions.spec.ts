import { expect, test } from "@playwright/test";

test.describe("iterate-versions workbench (REQ-2 / REQ-6)", () => {
  test("shows version metadata and restores the current snapshot", async ({
    page,
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
    await page.getByRole("tab", { name: "版本" }).click();

    const timeline = page.getByTestId("version-timeline");
    await expect(timeline).toBeVisible();
    const versionRow = timeline.getByTestId("version-row");
    await expect(versionRow.locator("p").first()).not.toBeEmpty();
    await expect(versionRow.getByText(/QA \d+ 分/)).toBeVisible();
    await expect(versionRow.getByText("当前版本")).toBeVisible();

    const projectUrl = new URL(page.url());
    const projectId = projectUrl.pathname.split("/").at(-1);
    const versionId = await versionRow.getAttribute("data-version-id");
    const rollback = await page.request.post(
      new URL(`/api/projects/${projectId}/versions`, page.url()).toString(),
      { data: { versionId } },
    );
    expect(rollback.ok()).toBe(true);
    expect((await rollback.json()).versionId).toBe(versionId);

    await page.getByRole("tab", { name: "代码" }).click();
    await expect(page.getByTestId("code-source")).not.toBeEmpty();
    await page.getByRole("tab", { name: "预览" }).click();
    await expect(page.getByTestId("preview-pane")).toBeVisible();
  });
});
