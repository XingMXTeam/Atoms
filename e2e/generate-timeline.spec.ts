import { expect, test } from "@playwright/test";

test.describe("generate-loop workbench timeline (REQ-4 / REQ-9)", () => {
  test("Agent timeline shows Chinese Planner / Architect / Engineer cards with expandable payload", async ({
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

    const timeline = page.getByTestId("agent-timeline");
    await expect(timeline).toBeVisible({ timeout: 15_000 });

    await expect(timeline.getByText("规划师")).toBeVisible();
    await expect(timeline.getByText("架构师")).toBeVisible();
    await expect(timeline.getByText("工程师")).toBeVisible();

    await expect(timeline.getByText("已完成").first()).toBeVisible({
      timeout: 20_000,
    });

    const plannerCard = timeline.getByTestId("agent-card-planner");
    await expect(plannerCard.getByText("已完成")).toBeVisible({
      timeout: 20_000,
    });

    const toggle = plannerCard.getByRole("button", { name: /展开详情|收起详情/ });
    await toggle.click();
    await expect(plannerCard.locator("pre")).toBeVisible();
  });

  test("SSE interrupt marks run interrupted and shows 继续", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("atoms.generate-loop.stageDelayMs", "1200");
    });

    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个会中断的演示应用");
    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });

    const timeline = page.getByTestId("agent-timeline");
    await expect(timeline).toBeVisible({ timeout: 15_000 });
    await expect(timeline.getByText("规划师")).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() =>
          typeof (window as unknown as { __ATOMS_ABORT_SSE__?: () => void })
            .__ATOMS_ABORT_SSE__ === "function",
        ),
      )
      .toBe(true);

    await page.evaluate(() => {
      (window as unknown as { __ATOMS_ABORT_SSE__: () => void }).__ATOMS_ABORT_SSE__();
    });

    await expect(page.getByRole("button", { name: "继续" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(timeline.getByText("连接已中断。可点击「继续」重新生成。")).toBeVisible();
    await expect(timeline).toHaveAttribute("data-run-status", "interrupted");
    await expect(page.getByTestId("workbench-run-status")).toHaveAttribute(
      "data-run-status",
      "interrupted",
    );
  });

  test("completed run hides interrupt recovery chrome and leaves 运行中", async ({
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

    const timeline = page.getByTestId("agent-timeline");
    await expect(timeline).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("agent-card-engineer").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });

    await expect(timeline).toHaveAttribute("data-run-status", "completed", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("workbench-run-status")).toHaveText("已完成");
    await expect(page.getByRole("button", { name: "继续" })).toHaveCount(0);
    await expect(timeline.getByText(/连接已中断/)).toHaveCount(0);
    await expect(page.getByText("运行中")).toHaveCount(0);
  });
});
