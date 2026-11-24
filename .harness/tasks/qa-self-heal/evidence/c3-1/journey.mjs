import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("触发修复演示：做一个中文待办清单");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  const qaCard = page.getByTestId("agent-card-qa");
  await qaCard.waitFor({ state: "visible", timeout: 30000 });
  await qaCard.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('[data-testid="agent-card-qa"]')?.getAttribute("data-status") === "completed", null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const completedWorkbenchUrl = page.url();
  await page.goto(completedWorkbenchUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const badge = document.querySelector('[data-testid="workbench-score-badge"]');
    const pane = document.querySelector('[data-testid="preview-pane"]');
    return badge?.getAttribute("data-run-qa-score") !== "" && pane?.getAttribute("data-preview-status") === "ready";
  }, null, { timeout: 15000 });
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/workbench-collapsed.png" });
  await qaCard.getByRole("button", { name: "展开质检详情" }).click();
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/workbench-expanded.png" });
  const workbench = await page.evaluate(() => ({
    title: document.title,
    score: document.querySelector('[data-testid="workbench-score-badge"]')?.innerText,
    scoreAttributes: Object.fromEntries([...document.querySelector('[data-testid="workbench-score-badge"]')?.attributes ?? []].map((a) => [a.name, a.value])),
    qaText: document.querySelector('[data-testid="agent-card-qa"]')?.innerText,
    previewStatus: document.querySelector('[data-testid="preview-pane"]')?.getAttribute("data-preview-status"),
    painted: document.querySelector('[data-testid="preview-pane"]')?.getAttribute("data-preview-painted"),
    clippedTextCount: [...document.querySelectorAll("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").length,
    bodyWidth: document.body.scrollWidth,
  }));
  await page.getByRole("link", { name: "返回首页" }).click();
  await page.waitForURL("http://127.0.0.1:3000/");
  await page.getByTestId("project-score-badge").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".harness/tasks/qa-self-heal/evidence/c3-1/home-with-score.png" });
  const home = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('[data-testid="project-score-badge"]')].map((e) => ({ score: e.innerText, rect: (() => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() })),
    clippedTextCount: [...document.querySelectorAll("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").length,
  }));
  await page.goto("http://127.0.0.1:3000/");
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  await prompt.fill("中断编辑后刷新");
  const beforeReload = await prompt.inputValue();
  await page.reload({ waitUntil: "networkidle" });
  const afterReload = await page.getByRole("textbox", { name: /描述你想生成的应用/ }).inputValue();
  await page.goBack().catch(() => null);
  const backUrl = page.url();
  await page.goForward().catch(() => null);
  const forwardUrl = page.url();
  console.log(JSON.stringify({ workbench, home, probes: { reloadMidEdit: { beforeReload, afterReload }, backForward: { backUrl, forwardUrl } }, pageErrors: errors }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
