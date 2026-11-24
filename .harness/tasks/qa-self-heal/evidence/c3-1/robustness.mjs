import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
try {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("做一个中文待办清单");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  const qaCard = page.getByTestId("agent-card-qa");
  await page.waitForFunction(() => document.querySelector('[data-testid="agent-card-qa"]')?.getAttribute("data-status") === "completed", null, { timeout: 30000 });
  await page.getByTestId("workbench-tab-preview").click();
  await page.getByTestId("preview-iframe").waitFor({ state: "visible", timeout: 15000 });
  await qaCard.getByRole("button", { name: "展开质检详情" }).click();
  const textBefore = await qaCard.innerText();
  const repairsBefore = (textBefore.match(/修复 · 第/g) ?? []).length;
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  const iframeCount = await page.locator("iframe").count();
  await page.evaluate(() => window.postMessage({ type: "preview-probe", report: "malformed host-source" }, "*"));
  if (frame) await frame.evaluate(() => parent.postMessage({ type: "preview-probe", report: "malformed iframe-source" }, "*"));
  await page.waitForTimeout(750);
  const textAfter = await qaCard.innerText();
  const repairsAfter = (textAfter.match(/修复 · 第/g) ?? []).length;
  const result = {
    projectUrl: page.url(),
    malformedUnexpectedSourceSent: true,
    malformedIframePayloadSent: Boolean(frame),
    iframeCount,
    timelineChanged: textAfter !== textBefore,
    repairCountBefore: repairsBefore,
    repairCountAfter: repairsAfter,
    acceptedProbeCountBefore: (textBefore.match(/探测 · 第/g) ?? []).length,
    acceptedProbeCountAfter: (textAfter.match(/探测 · 第/g) ?? []).length,
    timelineAfter: textAfter,
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
  await browser.close();
}
