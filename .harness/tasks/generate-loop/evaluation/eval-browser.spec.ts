import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const outDir = path.resolve(
  ".harness/tasks/generate-loop/evidence/c1-2-browser",
);
fs.mkdirSync(outDir, { recursive: true });

const results: Record<string, unknown>[] = [];
const cdnHits: string[] = [];

function summarize(text: string) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

test.describe.configure({ mode: "serial" });

test("evaluate generate-loop journeys + probes", async ({ page }) => {
  page.on("request", (req) => {
    const url = req.url();
    if (
      /esm\.sh|unpkg\.com|jsdelivr\.net|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(
        url,
      )
    ) {
      cdnHits.push(url);
    }
  });

  async function shot(name: string) {
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return `.harness/tasks/generate-loop/evidence/c1-2-browser/${name}.png`;
  }

  // --- Home structure (E2E-4 / E2E-5 / RB-2 / RB-3 / RB-31) ---
  await page.goto("/", { waitUntil: "networkidle" });
  const homeShot = await shot("home");
  const cards = page.getByRole("button", { name: /示例：/ });
  const cardCount = await cards.count();
  const submit = page.getByRole("button", { name: "开始生成" });
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  const projectsHeading = await page.getByRole("heading", { name: "我的项目" }).count();
  const homeText = summarize(await page.locator("main").innerText());
  const overflowHome = await page.evaluate(
    () =>
      [...document.querySelectorAll("body *")].filter(
        (e) =>
          (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 &&
          getComputedStyle(e).overflowX !== "visible",
      ).length,
  );
  const englishOnlyChrome =
    /\b(Planner|Architect|Engineer|Get Started|My Projects)\b/.test(homeText) &&
    !/我的项目|开始生成|规划|架构|工程/.test(homeText);

  results.push({
    id: "E2E-5",
    category: "boundary",
    result: cardCount >= 4 ? "PASS" : "FAIL",
    cardCount,
    projectsHeading,
    overflowHome,
    homeText,
    artifacts: [homeShot],
  });

  // empty submit (E2E-4)
  await prompt.fill("");
  const emptyDisabled = await submit.isDisabled();
  const before = page.url();
  if (!emptyDisabled) {
    await submit.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  const emptyShot = await shot("home-empty-submit");
  const stayedHome = new URL(page.url()).pathname === "/";
  results.push({
    id: "E2E-4",
    category: "negative",
    blocking: true,
    result: emptyDisabled && stayedHome ? "PASS" : "FAIL",
    emptyDisabled,
    stayedHome,
    before,
    after: page.url(),
    artifacts: [emptyShot],
  });

  // example fill (RB-31)
  await cards.first().click();
  const filled = await prompt.inputValue();
  const exampleShot = await shot("home-example-filled");
  results.push({
    id: "RB-31-probe",
    result: filled.length > 0 && cardCount >= 4 ? "PASS" : "FAIL",
    filled,
    artifacts: [exampleShot],
  });

  // long input probe
  await prompt.fill("测".repeat(1200));
  const longShot = await shot("home-long-input");
  results.push({
    id: "probe-long-input",
    length: (await prompt.inputValue()).length,
    artifacts: [longShot],
  });

  // double submit probe → core journey (E2E-1 / E2E-2 / E2E-7 / E2E-8)
  await prompt.fill("评测周期1：做一个简洁的待办清单应用");
  await Promise.all([
    submit.click().catch(() => {}),
    submit.click().catch(() => {}),
  ]);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 20000 });
  const workbenchUrl = page.url();
  const deviceCookie = (await page.context().cookies()).find((c) =>
    /device/i.test(c.name),
  );

  const timeline = page.getByTestId("agent-timeline");
  await expect(timeline).toBeVisible({ timeout: 20000 });
  await expect
    .poll(async () => timeline.getAttribute("data-run-status"), {
      timeout: 90000,
    })
    .toMatch(/completed|interrupted|failed/);

  const runStatus = await timeline.getAttribute("data-run-status");
  const afterGenerateShot = await shot("workbench-after-generate");

  const labelBits = {
    planner: summarize(await page.getByTestId("agent-card-planner").innerText()),
    architect: summarize(
      await page.getByTestId("agent-card-architect").innerText(),
    ),
    engineer: summarize(
      await page.getByTestId("agent-card-engineer").innerText(),
    ),
  };

  for (const agent of ["planner", "architect", "engineer"] as const) {
    const card = page.getByTestId(`agent-card-${agent}`);
    const toggle = card.getByRole("button", { name: /展开详情|收起详情/ });
    if (await toggle.count()) {
      const label =
        (await toggle.getAttribute("aria-label")) || (await toggle.innerText());
      if (/展开/.test(label)) await toggle.click();
    }
  }
  await page.waitForTimeout(300);
  const expandedShot = await shot("workbench-timeline-expanded");
  const plannerPre = await page
    .getByTestId("agent-card-planner")
    .locator("pre")
    .count();

  results.push({
    id: "E2E-2",
    category: "core",
    blocking: true,
    result:
      /规划师/.test(labelBits.planner) &&
      /架构师/.test(labelBits.architect) &&
      /工程师/.test(labelBits.engineer) &&
      plannerPre > 0
        ? "PASS"
        : "FAIL",
    runStatus,
    labelBits,
    plannerPreVisible: plannerPre > 0,
    artifacts: [afterGenerateShot, expandedShot],
  });

  // Preview / code tabs (E2E-1 / E2E-7 / RB-13 / RB-30 / RB-33)
  await page.getByTestId("workbench-tab-preview").click();
  const iframe = page.getByTestId("preview-iframe");
  await expect(iframe).toBeVisible({ timeout: 60000 });
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  await expect
    .poll(
      async () => {
        const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
        return (
          srcdoc.includes("我的待办") ||
          srcdoc.includes("\\u6211\\u7684\\u5f85\\u529e") ||
          srcdoc.includes("mock-app")
        );
      },
      { timeout: 60000 },
    )
    .toBe(true);

  await page.waitForTimeout(2500);
  const previewShot = await shot("workbench-preview");
  const box = await iframe.boundingBox();
  let previewClip:
    | { path: string; bytes: number; width: number; height: number }
    | null = null;
  if (box) {
    const clipPath = path.join(outDir, "preview-iframe-clip.png");
    await page.screenshot({
      path: clipPath,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, 900),
        height: Math.min(box.height, 640),
      },
    });
    previewClip = {
      path: ".harness/tasks/generate-loop/evidence/c1-2-browser/preview-iframe-clip.png",
      bytes: fs.statSync(clipPath).size,
      width: box.width,
      height: box.height,
    };
  }

  const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
  const sandbox = await iframe.getAttribute("sandbox");
  const srcdocHasCdn = /esm\.sh|unpkg\.com|jsdelivr|cdn\.tailwindcss/i.test(
    srcdoc,
  );

  await page.getByTestId("workbench-tab-code").click();
  await page.waitForTimeout(200);
  const codeShot = await shot("workbench-code");
  const fileButtons = page.locator(
    "[data-testid=code-file-tree] button, [data-testid=code-tab] button, aside button, nav button",
  );
  // Prefer explicit tree if present; fall back to any listed tsx path buttons.
  const treeButtons = page.getByRole("button", { name: /src\// });
  const fileCount = Math.max(await treeButtons.count(), await fileButtons.count());
  if ((await treeButtons.count()) > 0) {
    await treeButtons.first().click();
  }
  await page.waitForTimeout(200);
  const codeSelectedShot = await shot("workbench-code-selected");
  const codeText = summarize(await page.locator("main").innerText());

  await page.getByTestId("workbench-tab-preview").click();
  await page.waitForTimeout(500);
  const previewReturnShot = await shot("workbench-preview-return");
  const returnLen = ((await iframe.getAttribute("srcdoc")) ?? "").length;

  results.push({
    id: "E2E-1",
    category: "core",
    blocking: true,
    result:
      runStatus === "completed" &&
      srcdoc.length > 0 &&
      (/我的待办|mock-app/.test(srcdoc) || srcdoc.includes("\\u6211\\u7684\\u5f85\\u529e"))
        ? "PASS"
        : "FAIL",
    runStatus,
    sandbox,
    srcdocLen: srcdoc.length,
    srcdocHasCdn,
    previewClip,
    artifacts: [previewShot, previewClip?.path].filter(Boolean),
  });

  results.push({
    id: "E2E-7",
    category: "uiJourney",
    result:
      fileCount >= 1 &&
      /src\//.test(codeText) &&
      returnLen > 0 &&
      sandbox === "allow-scripts"
        ? "PASS"
        : "FAIL",
    fileCount,
    returnLen,
    sandbox,
    codeText,
    artifacts: [codeShot, codeSelectedShot, previewReturnShot],
  });

  results.push({
    id: "E2E-8",
    category: "crossFeature",
    result: deviceCookie ? "PASS" : "FAIL",
    cookieName: deviceCookie?.name ?? null,
    workbenchUrl,
  });

  results.push({
    id: "RB-33-cdn",
    result: cdnHits.length === 0 && !srcdocHasCdn ? "PASS" : "FAIL",
    cdnHits,
    srcdocHasCdn,
  });

  const overflowWorkbench = await page.evaluate(
    () =>
      [...document.querySelectorAll("body *")].filter(
        (e) =>
          (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 &&
          getComputedStyle(e).overflowX !== "visible",
      ).length,
  );
  results.push({ id: "measure-overflow-workbench", overflowWorkbench });

  // Header status wording while completed
  const runningCount = await page.getByText("运行中").count();
  const completedCount = await page.getByText("已完成").count();
  results.push({
    id: "probe-status-copy",
    runningCount,
    completedCount,
    runStatus,
  });

  // Interrupt journey (E2E-3 / RB-22)
  await page.goto("/");
  await prompt.fill("中断评测：做一个计数器");
  await submit.click();
  await page.waitForURL(/\/projects\//, { timeout: 20000 });
  // Abort in-flight requests to force disconnect semantics if stream starts
  await page.route("**/stream", (route) => route.abort());
  // Also hit continue UI by navigating with aborted client: reload after abort
  await page.waitForTimeout(500);
  // Prefer explicit interrupt hook if present
  const interruptBtn = page.getByRole("button", { name: "继续" });
  // Force client disconnect by closing SSE via page evaluate if exposed
  await page.evaluate(() => {
    // Best-effort: stop all EventSource instances
    // @ts-expect-error test hook
    if (window.__ATOMS_ABORT_RUN__) window.__ATOMS_ABORT_RUN__();
  }).catch(() => {});
  await page.waitForTimeout(1500);

  // If still not interrupted, open a dedicated abort by reloading mid-stream on a new run
  let continueVisible = (await interruptBtn.count()) > 0;
  let interruptStatus =
    (await page.getByTestId("agent-timeline").getAttribute("data-run-status")) ||
    "";
  if (!continueVisible) {
    // start another run and abort stream immediately
    await page.unroute("**/stream").catch(() => {});
    await page.goto("/");
    await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill(
      "中断评测2：做一个计数器",
    );
    await page.route("**/api/projects/*/runs/*/stream", async (route) => {
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "开始生成" }).click();
    await page.waitForURL(/\/projects\//, { timeout: 20000 });
    await page.waitForTimeout(2000);
    continueVisible =
      (await page.getByRole("button", { name: "继续" }).count()) > 0;
    interruptStatus =
      (await page
        .getByTestId("agent-timeline")
        .getAttribute("data-run-status")) || "";
  }
  const interruptShot = await shot("workbench-interrupted");
  const interruptMsg = await page.getByText(/连接已中断|继续/).count();
  results.push({
    id: "E2E-3",
    category: "negative",
    blocking: true,
    result: continueVisible || interruptStatus === "interrupted" ? "PASS" : "FAIL",
    continueVisible,
    interruptStatus,
    interruptMsg,
    artifacts: [interruptShot],
  });

  // Persistence (E2E-6)
  await page.goto("/");
  await page.reload({ waitUntil: "networkidle" });
  const homeProjectsShot = await shot("home-after-projects");
  const projectLinks = await page.locator("a[href*='/projects/']").count();
  const homeProjectsText = summarize(await page.locator("main").innerText());
  results.push({
    id: "E2E-6",
    category: "persistence",
    blocking: true,
    result: projectLinks >= 1 && /我的项目/.test(homeProjectsText) ? "PASS" : "FAIL",
    projectLinks,
    homeProjectsText,
    artifacts: [homeProjectsShot],
  });

  results.push({
    id: "home-chrome",
    englishOnlyChrome,
    cardCount,
    projectsHeading,
    overflowHome,
    artifacts: [homeShot],
  });

  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ results, cdnHits }, null, 2),
  );
  console.log(JSON.stringify({ results, cdnHits }, null, 2));
});
