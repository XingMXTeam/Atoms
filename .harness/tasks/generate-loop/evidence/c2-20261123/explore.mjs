import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require("@playwright/test");

const out = ".harness/tasks/generate-loop/evidence/c2-confirm-20261123";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const externalRequests = [];
let projectCreateRequests = 0;
page.on("request", (request) => {
  if (request.method() === "POST" && new URL(request.url()).pathname === "/api/projects") projectCreateRequests += 1;
  if (/esm\.sh|unpkg\.com|jsdelivr\.net|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(request.url())) externalRequests.push(request.url());
});
const observations = { probes: [], externalRequests };

await page.goto("http://127.0.0.1:3000/");
const homeMeasurements = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  bodyScrollWidth: document.body.scrollWidth,
  clippedTextElements: [...document.querySelectorAll("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").length,
  exampleCount: document.querySelectorAll('button[aria-label^="示例："]').length,
}));
await page.screenshot({ path: `${out}/home-detail.png`, fullPage: true });
const promptInput = page.getByRole("textbox", { name: /描述你想生成的应用/ });
await page.getByRole("button", { name: /示例：/ }).first().click();
observations.exampleCardFilled = (await promptInput.inputValue()).length > 0;
await page.screenshot({ path: `${out}/example-filled.png`, fullPage: true });

// Generate one project in this authenticated browser context for workbench evidence.
await promptInput.fill("做一个简洁的待办清单应用");
await page.getByRole("button", { name: "开始生成" }).click();
await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
await page.getByTestId("agent-card-engineer").getByText("已完成").waitFor({ timeout: 30000 });
await page.getByTestId("agent-card-planner").getByRole("button", { name: /展开详情|收起详情/ }).click();
await page.screenshot({ path: `${out}/workbench-timeline.png`, fullPage: true });
const timelineMeasurements = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  bodyScrollWidth: document.body.scrollWidth,
  clippedTextElements: [...document.querySelectorAll("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").length,
  timelineVisible: !!document.querySelector('[data-testid="agent-timeline"]'),
  timelineText: document.querySelector('[data-testid="agent-timeline"]')?.innerText,
}));
const payloadExpansion = {};
for (const agent of ["architect", "engineer"]) {
  const card = page.getByTestId(`agent-card-${agent}`);
  await card.getByRole("button", { name: /展开详情|收起详情/ }).click();
  payloadExpansion[agent] = await card.locator("pre").isVisible();
}
await page.screenshot({ path: `${out}/workbench-all-expanded.png`, fullPage: true });
observations.payloadExpansion = { planner: true, ...payloadExpansion };

await page.getByTestId("workbench-tab-code").click();
await page.getByTestId("code-pane").waitFor();
await page.screenshot({ path: `${out}/workbench-code.png`, fullPage: true });
const codeProbe = await page.getByTestId("code-pane").innerText();
await page.getByTestId("workbench-tab-preview").click();
await page.getByTestId("preview-pane").waitFor();
await page.getByTestId("preview-iframe").waitFor();
await page.getByTestId("preview-paint-probe").getByText("我的待办").waitFor({ timeout: 30000 });
await page.screenshot({ path: `${out}/workbench-preview.png`, fullPage: true });
const preview = await page.evaluate(() => ({
  sandbox: document.querySelector('[data-testid="preview-iframe"]')?.getAttribute("sandbox"),
  painted: document.querySelector('[data-testid="preview-pane"]')?.getAttribute("data-preview-painted"),
  probeText: document.querySelector('[data-testid="preview-paint-probe"]')?.innerText,
}));
observations.coreJourney = { homeMeasurements, timelineMeasurements, codeContainsAppFile: codeProbe.includes("src/App.tsx"), codeContainsMockCopy: codeProbe.includes("我的待办"), preview };

// Probe 1: long input with emoji, RTL, and 1,000+ characters remains editable.
await page.goto("http://127.0.0.1:3000/");
const longPrompt = `${"界面描述🙂 ".repeat(150)}שלום`;
const textbox = page.getByRole("textbox", { name: /描述你想生成的应用/ });
await textbox.fill(longPrompt);
observations.probes.push({ id: "long-input", chars: longPrompt.length, retained: (await textbox.inputValue()) === longPrompt, submitEnabled: await page.getByRole("button", { name: "开始生成" }).isEnabled() });

// Probe 2: double submit while request is in flight; count create requests.
await textbox.fill("快速重复提交检查");
const submit = page.getByRole("button", { name: "开始生成" });
const createRequestBaseline = projectCreateRequests;
await submit.click();
await submit.click({ force: true }).catch(() => {});
await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
await page.waitForTimeout(500);
const duplicateRoute = page.url();
observations.probes.push({ id: "double-submit", route: duplicateRoute, createRequests: projectCreateRequests - createRequestBaseline });
await page.goto("http://127.0.0.1:3000/");

// Probe 3: browser back/forward across a fresh generate navigation.
const navPage = await context.newPage();
await navPage.goto("http://127.0.0.1:3000/");
await navPage.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("检查浏览器前进和后退");
await navPage.getByRole("button", { name: "开始生成" }).click();
await navPage.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
await navPage.goBack({ waitUntil: "commit" });
const backUrl = navPage.url();
await navPage.goForward({ waitUntil: "commit" });
await navPage.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 10000 });
observations.probes.push({ id: "back-forward", backReturnedHome: new URL(backUrl).pathname === "/", forwardReturnedWorkbench: /\/projects\//.test(new URL(navPage.url()).pathname) });
await navPage.close();

await writeFile(`${out}/exploratory-results.json`, JSON.stringify(observations, null, 2));
await context.close();
await browser.close();
