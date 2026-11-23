import { expect, test } from "@playwright/test";

test.describe("generate-loop home (REQ-1)", () => {
  test("shows central prompt, ≥4 example cards, and 我的项目 region", async ({
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
    await expect(page.getByText("还没有项目，输入需求开始生成吧")).toBeVisible();
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
