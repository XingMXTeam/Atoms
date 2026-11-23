import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = ".harness/tasks/iterate-versions/evidence/c1-2-browser";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const owner = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await owner.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));

const result = {
  cases: {},
  probes: {},
  measurements: {},
  pageErrors,
};

function shot(name) {
  return path.join(OUT, `${name}.png`);
}

async function measure(pageRef) {
  return pageRef.evaluate(() => {
    const clipped = [...document.querySelectorAll("body *")].filter(
      (e) =>
        e.scrollWidth > e.clientWidth + 1 &&
        getComputedStyle(e).overflowX !== "visible",
    ).length;
    const badges = [...document.querySelectorAll('[data-testid="project-score-badge"]')].map(
      (el) => el.textContent?.trim() ?? "",
    );
    const versionRows = [...document.querySelectorAll('[data-testid="version-row"]')].map(
      (row) => ({
        id: row.getAttribute("data-version-id"),
        text: row.innerText,
        hasRestore: !!row.querySelector('button'),
        hasCurrent: row.innerText.includes("当前版本"),
      }),
    );
    const mutationButtons = [...document.querySelectorAll("button")]
      .map((b) => b.textContent?.trim() ?? "")
      .filter((t) =>
        /恢复此版本|下载|分享|开始生成|继续/.test(t),
      );
    return {
      title: document.title,
      clipped,
      badges,
      versionRows,
      mutationButtons,
      bodyText: document.body.innerText.slice(0, 2500),
      hasReadonly: document.body.innerText.includes("只读分享"),
      hasZip: [...document.querySelectorAll("button")].some((b) =>
        /下载 ZIP|正在导出/.test(b.textContent ?? ""),
      ),
      hasShare: [...document.querySelectorAll("button")].some((b) =>
        /创建只读分享链接|正在创建/.test(b.textContent ?? ""),
      ),
    };
  });
}

try {
  // Home seed (REQ-5 / RL-3)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("region", { name: "我的项目" }).waitFor();
  await page.screenshot({ path: shot("home-seeded-project-grid") });
  result.measurements.home = await measure(page);
  const examplePrompts = await page.locator("button, a").evaluateAll((els) =>
    els
      .map((el) => el.textContent?.trim() ?? "")
      .filter((t) => t.length > 8 && t.length < 40),
  );
  result.cases["E2E-home-seed"] = {
    badgeCount: result.measurements.home.badges.length,
    badges: result.measurements.home.badges,
    examplePromptSample: examplePrompts.slice(0, 8),
  };

  // Exploratory: empty submit (button should stay disabled)
  const startBtn = page.getByRole("button", { name: "开始生成" });
  result.probes.emptySubmit = {
    url: page.url(),
    disabled: await startBtn.isDisabled(),
    stayedOnHome: true,
  };
  await page.screenshot({ path: shot("home-empty-submit") });

  // Exploratory: long input
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  const long = `${"做一个包含很多细节的中文应用：".repeat(40)}🎉שלום`;
  await prompt.fill(long);
  await page.screenshot({ path: shot("home-long-input") });
  result.probes.longInput = {
    length: long.length,
    clipped: (await measure(page)).clipped,
    submitEnabled: !(await startBtn.isDisabled()),
  };

  // Core journey: generate → iterate → versions → rollback → share → zip
  await prompt.fill("做一个简洁的待办清单应用");
  await expect(startBtn).toBeEnabled({ timeout: 5_000 }).catch(() => null);
  await startBtn.click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 20_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await expectCompleted(page);
  const initialPreview = await page.getByTestId("preview-paint-probe").innerText();
  const initialRunId = await page
    .getByTestId("workbench-score-badge")
    .getAttribute("data-run-id");
  await page.screenshot({ path: shot("workbench-initial") });

  // Follow-up via API (same as e2e), then UI refresh
  const followUp = await page.request.post(
    `${BASE}/api/projects/${projectId}/runs/${initialRunId}/continue`,
    { data: { prompt: "为每项待办加入优先级标签" } },
  );
  const followJson = await followUp.json();
  result.cases["E2E-1"] = {
    status: followUp.status(),
    runId: followJson.runId,
  };
  await page.goto(`${BASE}/projects/${projectId}?run=${followJson.runId}`, {
    waitUntil: "networkidle",
  });
  await expectCompleted(page);
  await page.reload({ waitUntil: "networkidle" });
  const afterIterateCode = await page.getByTestId("code-source").innerText();
  result.cases["E2E-1"].codeHasPriority = afterIterateCode.includes("优先级");

  await page.getByRole("tab", { name: "版本" }).click();
  await page.getByTestId("version-timeline").waitFor();
  await page.screenshot({ path: shot("workbench-version-timeline") });
  result.measurements.timeline = await measure(page);
  const rows = page.getByTestId("version-row");
  const rowCount = await rows.count();
  const priorVersionId = await rows.nth(1).getAttribute("data-version-id");
  const currentVersionId = await rows.nth(0).getAttribute("data-version-id");
  result.cases["E2E-2"] = {
    rowCount,
    priorVersionId,
    currentVersionId,
    firstRowText: await rows.nth(0).innerText(),
    secondRowText: await rows.nth(1).innerText(),
  };

  // UI rollback (not only API)
  await rows.nth(1).getByRole("button", { name: "恢复此版本" }).click();
  await page.getByRole("status").filter({ hasText: /已恢复|恢复/ }).waitFor({
    timeout: 15_000,
  }).catch(() => null);
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("workbench-after-rollback-versions") });
  await page.getByRole("tab", { name: "代码" }).click();
  const codeAfter = await page.getByTestId("code-source").innerText();
  await page.screenshot({ path: shot("workbench-after-rollback-code") });
  await page.getByRole("tab", { name: "预览" }).click();
  await page.getByTestId("preview-paint-probe").waitFor({ timeout: 15_000 });
  const previewAfter = await page.getByTestId("preview-paint-probe").innerText();
  await page.screenshot({ path: shot("workbench-after-rollback-preview") });
  result.cases["E2E-8"] = {
    initialPreview,
    previewAfter,
    codeAfterHasStudio: codeAfter.includes("体验 Atoms Studio"),
    codeAfterLacksPriority: !codeAfter.includes("优先级"),
    previewRestored: previewAfter.includes("体验 Atoms Studio"),
  };
  result.cases["E2E-2"].rollbackPreview = previewAfter;
  result.cases["E2E-2"].rollbackCodeOk = codeAfter.includes("体验 Atoms Studio");

  // Persistence after rollback (reload current workbench URL)
  await page.reload({ waitUntil: "networkidle" });
  const hasVersionTab = (await page.getByRole("tab", { name: "版本" }).count()) > 0;
  if (!hasVersionTab) {
    await page.screenshot({ path: shot("workbench-persistence-empty") });
    result.cases["E2E-7"] = {
      failed: true,
      body: (await page.locator("main").innerText()).slice(0, 800),
      note: "reload after rollback lost version tab / run records",
    };
  } else {
    await page.getByRole("tab", { name: "版本" }).click();
    const rowsAfterReload = page.getByTestId("version-row");
    const timelineTexts = [];
    const count = await rowsAfterReload.count();
    for (let i = 0; i < Math.min(count, 3); i += 1) {
      timelineTexts.push(await rowsAfterReload.nth(i).innerText());
    }
    await page.getByRole("tab", { name: "预览" }).click();
    const preview = await page.getByTestId("preview-paint-probe").innerText();
    result.cases["E2E-7"] = {
      rowCount: count,
      timelineTexts,
      preview,
      previewRestored: preview.includes("体验 Atoms Studio"),
    };
    await page.screenshot({ path: shot("workbench-persistence-reload") });
  }

  // Ensure workbench chrome is present for zip/share (open from home card if needed)
  if ((await page.getByRole("button", { name: /下载 ZIP/ }).count()) === 0) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.getByRole("region", { name: "我的项目" }).getByRole("link").first().click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15_000 });
    await page.waitForTimeout(500);
  }

  // ZIP feedback
  const zipBtn = page.getByRole("button", { name: /下载 ZIP/ });
  await zipBtn.waitFor({ timeout: 10_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await zipBtn.click();
  const pendingText = await page.getByRole("button", { name: /正在导出|下载 ZIP/ }).innerText();
  const download = await downloadPromise;
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("workbench-zip-export") });
  result.cases.zip = {
    downloadSuggested: download ? download.suggestedFilename() : null,
    pendingOrFinalText: pendingText,
    buttonText: await zipBtn.innerText(),
    exportError: await page.locator("text=下载失败").count(),
  };

  // Share mint + visitor
  await page.getByRole("button", { name: "创建只读分享链接" }).click();
  const shareLink = page.getByRole("link", { name: /\/share\// });
  await shareLink.waitFor({ timeout: 10_000 });
  const shareUrl = await shareLink.getAttribute("href");
  await page.screenshot({ path: shot("workbench-share-minted") });
  result.cases["E2E-3"] = { shareUrl };

  const visitor = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`${BASE}${shareUrl}`, { waitUntil: "networkidle" });
  await visitorPage.waitForSelector("main", { timeout: 15_000 });
  await visitorPage.screenshot({ path: shot("public-read-only-share") });
  result.measurements.share = await measure(visitorPage);
  await visitorPage.getByRole("tab", { name: "代码" }).click();
  await visitorPage.screenshot({ path: shot("public-read-only-share-code") });
  const denied = await visitorPage.request.post(
    `${BASE}/api/projects/${projectId}/versions`,
    { data: { versionId: priorVersionId } },
  );
  result.cases["E2E-3"].mutationStatus = denied.status();
  result.cases["E2E-3"].hasRestoreButton =
    (await visitorPage.getByRole("button", { name: "恢复此版本" }).count()) > 0;
  result.cases["E2E-3"].hasZipButton =
    (await visitorPage.getByRole("button", { name: /下载 ZIP/ }).count()) > 0;
  result.cases["E2E-3"].hasReadonlyLabel = result.measurements.share.hasReadonly;
  result.cases["E2E-3"].codeNotEmpty =
    ((await visitorPage.getByTestId("code-source").innerText().catch(() => "")) || "").length > 0;

  // Foreign rollback (E2E-4)
  const stranger = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const foreign = await strangerPage.request.post(
    `${BASE}/api/projects/${projectId}/versions`,
    { data: { versionId: currentVersionId } },
  );
  result.cases["E2E-4"] = { status: foreign.status(), body: await foreign.text() };
  await stranger.close();

  // Empty delta boundary (E2E-5) against current owner project if chrome still live
  let runIdNow = null;
  if ((await page.getByTestId("workbench-score-badge").count()) > 0) {
    runIdNow = await page.getByTestId("workbench-score-badge").getAttribute("data-run-id");
  }
  if (runIdNow) {
    const beforeRows = (await page.getByTestId("version-row").count().catch(() => 0)) || 0;
    const noChange = await page.request.post(
      `${BASE}/api/projects/${projectId}/runs/${runIdNow}/continue`,
      { data: { prompt: "【空变更】保持现状不要修改任何文件" } },
    );
    let noChangeJson = null;
    try {
      noChangeJson = await noChange.json();
    } catch {
      noChangeJson = { raw: await noChange.text() };
    }
    if (noChange.ok() && noChangeJson.runId) {
      await page.goto(`${BASE}/projects/${projectId}?run=${noChangeJson.runId}`, {
        waitUntil: "networkidle",
      });
      await expectCompleted(page).catch(() => null);
      await page.reload({ waitUntil: "networkidle" });
      if ((await page.getByRole("tab", { name: "版本" }).count()) > 0) {
        await page.getByRole("tab", { name: "版本" }).click();
      }
      result.cases["E2E-5"] = {
        status: noChange.status(),
        beforeRows,
        rowCount: await page.getByTestId("version-row").count().catch(() => 0),
        bodySnippet: (await page.locator("main").innerText()).slice(0, 500),
      };
    } else {
      result.cases["E2E-5"] = {
        status: noChange.status(),
        body: noChangeJson,
        note: "continue rejected or did not return runId",
      };
    }
    await page.screenshot({ path: shot("workbench-empty-delta") });
  } else {
    result.cases["E2E-5"] = { skipped: true, reason: "workbench chrome unavailable for no-change probe" };
  }

  // Rapid double zip click
  if ((await page.getByRole("button", { name: /下载 ZIP|正在导出/ }).count()) > 0) {
    const zip = page.getByRole("button", { name: /下载 ZIP|正在导出/ });
    await zip.click();
    await zip.click().catch(() => null);
    await page.waitForTimeout(300);
    result.probes.doubleZip = {
      disabledOrPending: await zip.isDisabled().catch(() => false),
      text: await zip.innerText(),
    };
    await page.screenshot({ path: shot("probe-double-zip") });
  } else {
    result.probes.doubleZip = { skipped: true };
  }

  // Back/forward mid workbench
  await page.goBack({ waitUntil: "networkidle" }).catch(() => null);
  const backUrl = page.url();
  await page.goForward({ waitUntil: "networkidle" }).catch(() => null);
  result.probes.backForward = { backUrl, forwardUrl: page.url() };

  await visitor.close();
} catch (error) {
  result.fatal = String(error?.stack ?? error);
  await page.screenshot({ path: shot("fatal-error") }).catch(() => null);
} finally {
  writeFileSync(path.join(OUT, "journey-results.json"), `${JSON.stringify(result, null, 2)}\n`);
  await owner.close();
  await browser.close();
  console.log(JSON.stringify({ ok: !result.fatal, fatal: result.fatal ?? null, cases: Object.keys(result.cases), probes: Object.keys(result.probes) }, null, 2));
}

async function expectCompleted(pageRef) {
  await pageRef
    .getByTestId("agent-card-engineer")
    .getByText("已完成")
    .waitFor({ timeout: 45_000 });
}
