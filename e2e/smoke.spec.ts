import { expect, test } from "@playwright/test";

const DEVICE_ID_COOKIE = "deviceId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("document responses include baseline security headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["strict-transport-security"]).toBeUndefined();
});

test("robots.txt and sitemap.xml are served from the app", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://atoms.maoxunxing.com/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("https://atoms.maoxunxing.com/");
});

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
