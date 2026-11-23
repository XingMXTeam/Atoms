import { expect, test } from "@playwright/test";

test.describe("generate-loop submit (REQ-2)", () => {
  test("empty prompt does not navigate to workbench", async ({ page }) => {
    await page.goto("/");

    const submit = page.getByRole("button", { name: "开始生成" });
    await expect(submit).toBeDisabled();

    await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("   ");
    await expect(submit).toBeDisabled();
    await expect(page).toHaveURL("/");
  });

  test("submitting a prompt creates project+run and opens workbench", async ({
    page,
  }) => {
    await page.goto("/");

    const promptText = "做一个简洁的待办清单应用";
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill(promptText);

    const submit = page.getByRole("button", { name: "开始生成" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });
    await expect(page.getByText("工作台")).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get("run")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
