import { expect, test } from "@playwright/test";

const DEVICE_ID_COOKIE = "deviceId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("home page shows Chinese product title", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Atoms Studio/);
});

test("first visit mints HttpOnly deviceId cookie that persists across reload", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
  ).toBeVisible();

  const afterFirst = await context.cookies();
  const deviceCookie = afterFirst.find((c) => c.name === DEVICE_ID_COOKIE);
  expect(deviceCookie, "deviceId cookie should be set on first visit").toBeTruthy();
  expect(deviceCookie!.value).toMatch(UUID_RE);
  expect(deviceCookie!.httpOnly, "deviceId must be HttpOnly").toBe(true);
  expect(deviceCookie!.sameSite?.toLowerCase()).toBe("lax");
  expect(deviceCookie!.path).toBe("/");

  // HttpOnly: not readable from document.cookie
  const documentCookie = await page.evaluate(() => document.cookie);
  expect(documentCookie).not.toContain(`${DEVICE_ID_COOKIE}=`);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
  ).toBeVisible();

  const afterReload = await context.cookies();
  const reloaded = afterReload.find((c) => c.name === DEVICE_ID_COOKIE);
  expect(reloaded, "deviceId cookie should remain after reload").toBeTruthy();
  expect(reloaded!.value).toBe(deviceCookie!.value);
});
