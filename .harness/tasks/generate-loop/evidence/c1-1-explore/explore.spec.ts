import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const outDir = path.resolve(".harness/tasks/generate-loop/evidence/c1-1-explore");
fs.mkdirSync(outDir, { recursive: true });
const results: any[] = [];
const cdnHits: string[] = [];

function summarize(text: string) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 400);
}

test.describe.configure({ mode: "serial" });

test("exploratory probes and workbench evidence", async ({ page }) => {
  page.on("request", (req) => {
    const url = req.url();
    if (/esm\.sh|unpkg\.com|jsdelivr\.net|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
      cdnHits.push(url);
    }
  });

  async function shot(name: string) {
    const p = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    return p;
  }

  await page.goto("/", { waitUntil: "networkidle" });
  await shot("home-initial");
  const homeText = await page.locator("main").innerText();
  const cards = page.getByRole("button", { name: /示例：/ });
  const cardCount = await cards.count();
  const cardNames: (string | null)[] = [];
  for (let i = 0; i < cardCount; i++) cardNames.push(await cards.nth(i).getAttribute("aria-label"));
  const projectsHeading = await page.getByText("我的项目").count();
  const overflowHome = await page.evaluate(
    () =>
      [...document.querySelectorAll("body *")].filter(
        (e) =>
          (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 &&
          getComputedStyle(e).overflowX !== "visible",
      ).length,
  );
  results.push({
    id: "home-structure",
    cardCount,
    cardNames,
    projectsHeading,
    overflowHome,
    homeText: summarize(homeText),
  });

  const beforeUrl = page.url();
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  const submit = page.getByRole("button", { name: "开始生成" });
  await prompt.fill("");
  const disabled = await submit.isDisabled();
  if (!disabled) await submit.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  results.push({
    id: "probe-empty-submit",
    disabled,
    stayed: page.url() === beforeUrl || new URL(page.url()).pathname === "/",
    url: page.url(),
  });
  await shot("home-empty-submit");

  await cards.first().click();
  const filled = await prompt.inputValue();
  results.push({ id: "probe-example-fill", filled, ok: filled.length > 0 && cardCount >= 4 });
  await shot("home-example-filled");

  const long = "测".repeat(1200);
  await prompt.fill(long);
  const longVal = await prompt.inputValue();
  await shot("home-long-input");
  results.push({ id: "probe-long-input", length: longVal.length });

  await prompt.fill("评测探针对重复提交：做一个待办清单");
  await Promise.all([
    submit.click().catch(() => {}),
    submit.click().catch(() => {}),
    submit.click().catch(() => {}),
  ]);
  await page.waitForURL(/\/projects\//, { timeout: 20000 });
  const workbenchUrl = page.url();
  results.push({ id: "probe-double-submit", url: workbenchUrl });

  const timeline = page.getByTestId("agent-timeline");
  await timeline.waitFor({ timeout: 30000 });
  await page
    .waitForFunction(() => {
      const el = document.querySelector("[data-testid=agent-timeline]");
      const s = el && el.getAttribute("data-run-status");
      return s === "completed" || s === "interrupted" || s === "failed";
    }, undefined, { timeout: 90000 })
    .catch(() => null);
  const runStatus = await timeline.getAttribute("data-run-status");
  await shot("workbench-after-generate");

  const labelBits = {
    planner: summarize(await page.getByTestId("agent-card-planner").innerText()),
    architect: summarize(await page.getByTestId("agent-card-architect").innerText()),
    engineer: summarize(await page.getByTestId("agent-card-engineer").innerText()),
  };

  for (const agent of ["planner", "architect", "engineer"] as const) {
    const card = page.getByTestId(`agent-card-${agent}`);
    const toggle = card.getByRole("button", { name: /展开详情|收起详情/ });
    if (await toggle.count()) {
      const name = (await toggle.getAttribute("aria-label")) || (await toggle.innerText());
      if (/展开/.test(name)) await toggle.click();
    }
  }
  await page.waitForTimeout(400);
  await shot("workbench-timeline-expanded");
  const plannerPre = await page.getByTestId("agent-card-planner").locator("pre").count();
  results.push({ id: "timeline", runStatus, labelBits, plannerPreVisible: plannerPre > 0 });

  await page.getByTestId("workbench-tab-preview").click();
  const iframe = page.getByTestId("preview-iframe");
  await iframe.waitFor({ timeout: 60000 });
  const sandbox = await iframe.getAttribute("sandbox");
  const srcdoc = (await iframe.getAttribute("srcdoc")) || "";
  await page.waitForTimeout(1500);
  await shot("workbench-preview");

  await page.getByTestId("workbench-tab-code").click();
  await page.waitForTimeout(400);
  await shot("workbench-code");
  const treeText = summarize(await page.getByTestId("code-pane").innerText().catch(() => ""));
  const fileButtons = await page
    .getByTestId("code-file-tree")
    .locator("button")
    .count()
    .catch(() => 0);
  if (fileButtons > 0) {
    await page.getByTestId("code-file-tree").locator("button").first().click().catch(() => {});
  }
  await page.waitForTimeout(200);
  await shot("workbench-code-selected");

  await page.getByTestId("workbench-tab-preview").click();
  await page.waitForTimeout(800);
  await shot("workbench-preview-return");
  const srcdoc2 = (await iframe.getAttribute("srcdoc")) || "";
  results.push({
    id: "preview-code",
    sandbox,
    srcdocLen: srcdoc.length,
    hasMockMarker: /我的待办|mock-app|\\u6211\\u7684\\u5f85\\u529e/.test(srcdoc),
    srcdocHasCdn: /esm\.sh|unpkg\.com|jsdelivr|cdn\.tailwindcss/.test(srcdoc),
    treeText,
    fileButtons,
    returnPreviewLen: srcdoc2.length,
    cdnHits: [...cdnHits],
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("atoms.generate-loop.stageDelayMs", "1500"));
  await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("中断探针对：做一个计数器");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\//, { timeout: 20000 });
  await page.getByTestId("agent-timeline").waitFor({ timeout: 20000 });
  await page.waitForFunction(
    () => typeof (window as any).__ATOMS_ABORT_SSE__ === "function",
    undefined,
    { timeout: 20000 },
  );
  await page.evaluate(() => (window as any).__ATOMS_ABORT_SSE__());
  await page.getByRole("button", { name: "继续" }).waitFor({ timeout: 15000 });
  const continueVisible = await page.getByRole("button", { name: "继续" }).isVisible();
  const interruptMsg = await page.getByText("连接已中断").count();
  const interruptStatus = await page.getByTestId("agent-timeline").getAttribute("data-run-status");
  await shot("workbench-interrupted");
  results.push({ id: "probe-interrupt", continueVisible, interruptMsg, interruptStatus });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await shot("home-after-projects");
  const projectLinks = await page.locator("main a[href^='/projects/']").count();
  const homeProjectsText = summarize(await page.locator("main").innerText());
  results.push({ id: "probe-persistence-home", projectLinks, homeProjectsText });

  await page.goto(workbenchUrl, { waitUntil: "networkidle" });
  const overflowWorkbench = await page.evaluate(
    () =>
      [...document.querySelectorAll("body *")].filter(
        (e) =>
          (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 &&
          getComputedStyle(e).overflowX !== "visible",
      ).length,
  );
  results.push({ id: "measure-overflow-workbench", overflowWorkbench });
  await shot("workbench-final");

  const payload = { results, cdnHits };
  fs.writeFileSync(path.join(outDir, "probes.json"), JSON.stringify(payload, null, 2));
  console.log("PROBES_JSON_START");
  console.log(JSON.stringify(payload, null, 2));
  console.log("PROBES_JSON_END");

  expect(cardCount).toBeGreaterThanOrEqual(4);
});
