import { expect, test } from "@playwright/test";

test.describe("generate-loop home (REQ-1)", () => {
  test("shows the prompt, examples, and seeded projects", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
    ).toBeVisible();

    const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
    await expect(prompt).toBeVisible();

    const exampleCards = page.getByRole("button", { name: /示例：/ });
    await expect(exampleCards).toHaveCount(4, { timeout: 10_000 });

    await expect(page.getByRole("heading", { name: "我的项目" })).toBeVisible();
    await expect(page.getByTestId("project-score-badge")).toHaveCount(2);
    await expect(page.getByRole("link", { name: /待办清单示例|专注计时器示例/ })).toHaveCount(2);
    await expect(page.getByTestId("project-card").first()).toContainText(
      /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/,
    );
  });

  test("example projects show preset QA evidence instead of identical pass reasons", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i);

    const qaCard = page.getByTestId("agent-card-qa");
    await expect(qaCard).toContainText("示例项目，无真实耗时", { timeout: 15_000 });
    await qaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(page.getByTestId("qa-preset-evidence")).toBeVisible();
    await expect(qaCard.getByText(/预置示例：页面含标题/)).toBeVisible();
    await expect(qaCard.getByText(/预置示例：表单/)).toBeVisible();
    await expect(qaCard.getByText(/预置示例：任务勾选/)).toBeVisible();
    await expect(qaCard.getByText("预览正常渲染且交互可用")).toHaveCount(0);
  });

  test("clicking an example card fills the central prompt", async ({ page }) => {
    await page.goto("/");

    const firstCard = page.getByRole("button", { name: /示例：/ }).first();
    const accessibleName = (await firstCard.getAttribute("aria-label")) ?? "";
    const cardPrompt = accessibleName.replace(/^示例：\s*/, "").trim();
    expect(cardPrompt.length).toBeGreaterThan(0);
    await firstCard.click();

    const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
    await expect(prompt).toHaveValue(cardPrompt);
  });
});
