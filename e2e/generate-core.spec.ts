import { expect, test } from "@playwright/test";

test.describe("generate-loop core journey (REQ-10 / E2E-1)", () => {
  test("generate → timeline complete → preview shows expected mock content", async ({
    page,
  }) => {
    await page.goto("/");

    // Prefer an example card (boundary fill) then submit.
    const firstCard = page.getByRole("button", { name: /示例：/ }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
    await expect(prompt).not.toHaveValue("");

    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });

    const timeline = page.getByTestId("agent-timeline");
    await expect(timeline).toBeVisible({ timeout: 15_000 });
    await expect(timeline.getByText("规划师")).toBeVisible();
    await expect(timeline.getByText("架构师")).toBeVisible();
    await expect(timeline.getByText("工程师")).toBeVisible();

    await expect(
      page.getByTestId("agent-card-planner").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("agent-card-architect").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("agent-card-engineer").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });

    await expect(timeline).toHaveAttribute("data-run-status", "completed", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("workbench-run-status")).toHaveAttribute(
      "data-run-status",
      "completed",
    );
    await expect(page.getByRole("button", { name: "继续" })).toHaveCount(0);
    await expect(timeline.getByText(/连接已中断/)).toHaveCount(0);
    await expect(page.getByText("运行中")).toHaveCount(0);

    await page.getByTestId("workbench-tab-preview").click();

    const iframe = page.getByTestId("preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 60_000 });
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");

    await expect
      .poll(
        async () => {
          const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
          return (
            srcdoc.includes("我的待办") ||
            /\\u6211\\u7684\\u5[fF]85\\u529[eE]/i.test(srcdoc) ||
            srcdoc.includes("mock-app")
          );
        },
        { timeout: 60_000 },
      )
      .toBe(true);

    const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
    expect(srcdoc.length).toBeGreaterThan(0);
    expect(srcdoc).not.toMatch(/esm\.sh|unpkg\.com|jsdelivr|cdn\.tailwindcss/i);

    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-painted",
      "true",
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "我的待办",
    );
  });
});
