import { expect, test } from "@playwright/test";

const DEVICE_ID_COOKIE = "deviceId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Planner mock fixture title — see src/lib/agents/fixtures.ts */
const PLANNER_TITLE = "中文待办清单";

test.describe("generate-loop persistence journey (REQ-10 / E2E-6)", () => {
  test("after mock generate + hard refresh, 我的项目 lists Planner-derived title", async ({
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
    const projectUrl = page.url();
    const projectId = new URL(projectUrl).pathname.split("/").pop();
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);

    await expect(
      page.getByTestId("agent-card-planner").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("agent-card-engineer").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });

    // Navigate home and hard-refresh so the server re-lists projects.
    await page.goto("/");
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "我的项目" })).toBeVisible();
    const projectLink = page.getByRole("link", { name: new RegExp(PLANNER_TITLE) });
    await expect(projectLink).toBeVisible({ timeout: 15_000 });
    await expect(projectLink).toHaveAttribute("href", `/projects/${projectId}`);
  });
});

test.describe("generate-loop deviceId scoping (E2E-8)", () => {
  test("clean cookies mint deviceId and project stays scoped to this browser", async ({
    page,
    context,
    browser,
  }) => {
    await context.clearCookies();

    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个仅本设备可见的演示应用");
    await page.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });
    const projectId = new URL(page.url()).pathname.split("/").pop();

    await expect(
      page.getByTestId("agent-card-engineer").getByText("已完成"),
    ).toBeVisible({ timeout: 30_000 });

    const cookies = await context.cookies();
    const deviceCookie = cookies.find((c) => c.name === DEVICE_ID_COOKIE);
    expect(deviceCookie, "deviceId cookie should be present").toBeTruthy();
    expect(deviceCookie!.value).toMatch(UUID_RE);

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: new RegExp(PLANNER_TITLE) }),
    ).toBeVisible({ timeout: 15_000 });

    // A fresh browser context (no shared cookies) must not see this project.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    await expect(otherPage.getByRole("heading", { name: "我的项目" })).toBeVisible();
    await expect(
      otherPage.getByRole("link", { name: new RegExp(PLANNER_TITLE) }),
    ).toHaveCount(0);
    await expect(
      otherPage.locator(`a[href="/projects/${projectId}"]`),
    ).toHaveCount(0);
    await other.close();
  });
});
