import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
try {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("持续失败演示：做一个中文待办清单");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  const qaCard = page.getByTestId("agent-card-qa");
  await page.waitForFunction(() => document.querySelector('[data-testid="agent-card-qa"]')?.getAttribute("data-status") === "completed", null, { timeout: 30000 });
  await page.goto(page.url(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('[data-testid="workbench-score-badge"]')?.getAttribute("data-run-qa-rounds") === "3", null, { timeout: 15000 });
  await qaCard.getByRole("button", { name: "展开质检详情" }).click();
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/workbench-exhaustion-top.png" });
  await qaCard.getByText("修复上限 · 第 3 轮").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/workbench-exhaustion-details.png" });
  console.log(JSON.stringify({
    url: page.url(),
    score: await page.getByTestId("workbench-score-badge").innerText(),
    attributes: await page.getByTestId("workbench-score-badge").evaluate((e) => Object.fromEntries([...e.attributes].map((a) => [a.name, a.value]))),
    exhausted: await qaCard.getByText("已达修复上限（第 3 轮）").count(),
    repairs: await qaCard.getByText(/修复 · 第 [123] 轮/).allTextContents(),
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
