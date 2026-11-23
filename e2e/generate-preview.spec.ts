import { expect, test } from "@playwright/test";

test.describe("generate-loop preview + 代码 (REQ-5 / REQ-6)", () => {
  test("preview iframe sandboxes allow-scripts only and shows mock content", async ({
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

    await expect(page.getByTestId("agent-timeline")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("agent-card-engineer").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("workbench-tab-preview").click();

    const iframe = page.getByTestId("preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 60_000 });
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).toBe("allow-scripts");
    expect(sandbox?.includes("allow-same-origin")).toBe(false);

    // Opaque-origin iframe: assert via srcdoc (no host cookie access path).
    await expect
      .poll(async () => {
        const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
        return (
          srcdoc.includes("我的待办") ||
          srcdoc.includes("\\u6211\\u7684\\u5f85\\u529e") ||
          srcdoc.includes("mock-app")
        );
      }, { timeout: 60_000 })
      .toBe(true);

    const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
    expect(srcdoc).not.toMatch(/esm\.sh|unpkg\.com|jsdelivr|cdn\.tailwindcss/i);

    await page.getByTestId("workbench-tab-code").click();
    await expect(page.getByTestId("code-pane")).toBeVisible();
    await expect(page.getByTestId("code-file-tree")).toContainText("src/App.tsx");
    await page.getByRole("button", { name: "src/App.tsx" }).click();
    await expect(page.getByTestId("code-source")).toContainText("我的待办");

    await page.getByTestId("workbench-tab-preview").click();
    await expect(page.getByTestId("preview-iframe")).toBeVisible();
  });
});
