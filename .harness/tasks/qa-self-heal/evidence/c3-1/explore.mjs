import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));

try {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  const submit = page.getByRole("button", { name: "开始生成" });
  await prompt.fill("Exploratory probe: long text 😀 שלום " + "x".repeat(1100));
  const afterLongInput = { length: await prompt.inputValue().then((value) => value.length), submitEnabled: await submit.isEnabled() };
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/home-long-input.png" });
  await prompt.fill("做一个中文待办清单");
  const afterNormalInput = { submitEnabled: await submit.isEnabled() };
  await page.waitForTimeout(500);
  const form = await page.locator("form").evaluate((element) => ({ html: element.outerHTML, disabled: [...element.querySelectorAll("button")].map((button) => button.disabled) }));
  const layout = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    clippedTextCount: [...document.querySelectorAll("body *")].filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== "visible").length,
    bodyText: document.body.innerText.slice(0, 500),
  }));
  await page.goBack().catch(() => null);
  const backUrl = page.url();
  await page.goForward().catch(() => null);
  const forwardUrl = page.url();
  await page.reload({ waitUntil: "networkidle" });
  console.log(JSON.stringify({ afterLongInput, afterNormalInput, form, layout, backUrl, forwardUrl, reloadedUrl: page.url(), consoleErrors, failedRequests }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
