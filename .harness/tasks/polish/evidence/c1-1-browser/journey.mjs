import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = ".harness/tasks/polish/evidence/c1-1-browser";
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
  a11y: {},
  cdn: { urls: [], offenders: [] },
  pageErrors,
};

function shot(name) {
  return path.join(OUT, `${name}.png`);
}

const BLOCKED = [
  "esm.sh",
  "unpkg.com",
  "jsdelivr",
  "cdn.tailwindcss.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

function isBlocked(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED.some((b) => host === b || host.endsWith(`.${b}`) || host.includes(b));
  } catch {
    return BLOCKED.some((b) => url.toLowerCase().includes(b));
  }
}

async function measureOverflow(pageRef) {
  return pageRef.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const clipped = [...document.querySelectorAll("body *")].filter(
      (e) =>
        e.scrollWidth > e.clientWidth + 1 &&
        getComputedStyle(e).overflowX !== "visible",
    ).length;
    const cards = [...document.querySelectorAll('[data-testid="project-card"]')].map((el) => {
      const title = el.querySelector('[data-testid="project-card-title"]');
      const style = title ? getComputedStyle(title) : null;
      return {
        title: title?.textContent?.trim() ?? "",
        titleClipped:
          !!title &&
          title.scrollWidth > title.clientWidth + 1 &&
          style?.textOverflow !== "ellipsis" &&
          style?.overflow === "visible",
        cardOverflowX: el.scrollWidth - el.clientWidth,
      };
    });
    const fonts = getComputedStyle(document.body).fontFamily;
    return {
      docOverflow: doc.scrollWidth - doc.clientWidth,
      bodyOverflow: body.scrollWidth - body.clientWidth,
      clipped,
      cards,
      fonts,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
    };
  });
}

async function contrastSample(pageRef) {
  return pageRef.evaluate(() => {
    function parseColor(c) {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    function lin(c) {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    function lum([r, g, b]) {
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }
    function ratio(fg, bg) {
      const L1 = lum(fg);
      const L2 = lum(bg);
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function bgOf(el) {
      let cur = el;
      while (cur) {
        const bg = getComputedStyle(cur).backgroundColor;
        const parsed = parseColor(bg);
        if (parsed && !(parsed[0] === 0 && parsed[1] === 0 && parsed[2] === 0 && bg.includes("0)"))) {
          return parsed;
        }
        cur = cur.parentElement;
      }
      return parseColor(getComputedStyle(document.body).backgroundColor);
    }
    const samples = [];
    for (const sel of ["h1", "main p", "button", "[role=tab]"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const fg = parseColor(getComputedStyle(el).color);
      const bg = bgOf(el);
      if (!fg || !bg) continue;
      samples.push({
        sel,
        text: (el.textContent ?? "").trim().slice(0, 40),
        ratio: Number(ratio(fg, bg).toFixed(2)),
        fg,
        bg,
      });
    }
    return samples;
  });
}

async function focusRingOn(el) {
  return el.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
      hasRing:
        (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
        style.boxShadow !== "none",
      classList: [...node.classList],
    };
  });
}

try {
  page.on("request", (req) => {
    const url = req.url();
    result.cdn.urls.push(url);
    if (isBlocked(url)) result.cdn.offenders.push(url);
  });

  // —— Home visual system (1280) ——
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "可验证的 AI 应用生成" }).waitFor();
  await page.screenshot({ path: shot("home-visual-system-1280") });
  result.measurements.home1280 = await measureOverflow(page);
  result.a11y.homeContrast = await contrastSample(page);

  // Focus-visible on submit
  const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
  await prompt.fill("做一个简洁的待办清单应用");
  const submit = page.getByRole("button", { name: "开始生成" });
  await prompt.focus();
  await page.keyboard.press("Tab");
  result.a11y.submitFocus = await focusRingOn(submit);
  await page.screenshot({ path: shot("home-focus-submit") });

  // Exploratory probes on home
  result.probes.emptySubmit = {
    disabledWhenEmpty: await (async () => {
      await prompt.fill("");
      return submit.isDisabled();
    })(),
  };
  const long = `${"做一个包含很多细节的中文应用：".repeat(40)}🎉שלום`;
  await prompt.fill(long);
  await page.screenshot({ path: shot("home-long-input") });
  result.probes.longInput = {
    length: long.length,
    submitEnabled: !(await submit.isDisabled()),
    clipped: (await measureOverflow(page)).clipped,
  };

  // Home at 375
  await page.setViewportSize({ width: 375, height: 812 });
  await prompt.fill("做一个简洁的待办清单应用");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: shot("home-visual-system-375") });
  result.measurements.home375 = await measureOverflow(page);

  // —— Workbench via seeded project ——
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /待办清单示例/ }).first().click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByTestId("follow-up-form").waitFor({ timeout: 15_000 });
  await page.screenshot({ path: shot("workbench-polish-states") });
  result.measurements.workbench = await measureOverflow(page);

  // Landmarks / labelled tabs / iframe
  result.a11y.workbench = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    const tablist = document.querySelector('[role="tablist"]');
    const iframe = document.querySelector('[data-testid="preview-iframe"]');
    return {
      tabs,
      tablistLabel: tablist?.getAttribute("aria-label") ?? tablist?.getAttribute("aria-labelledby"),
      iframeTitle: iframe?.getAttribute("title") ?? null,
      iframeSandbox: iframe?.getAttribute("sandbox") ?? null,
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
      main: !!document.querySelector("main"),
      followUpVisible: !!document.querySelector('[data-testid="follow-up-form"]'),
      qaRounds: document.querySelector('[data-testid="workbench-qa-rounds"]')?.textContent?.trim() ?? null,
      qaRoundsAttr:
        document.querySelector('[data-testid="workbench-qa-rounds"]')?.getAttribute("data-run-qa-rounds") ??
        null,
      banners: [...document.querySelectorAll('[data-testid^="ux-banner"]')].map((el) => ({
        id: el.getAttribute("data-testid"),
        text: el.textContent?.trim().slice(0, 80),
      })),
    };
  });

  // Preview width toggle
  await page.getByRole("tab", { name: "预览" }).click();
  await expect(page.getByTestId("preview-iframe")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("preview-width-toggle")).toBeVisible();
  const desktopWidth = await page.getByTestId("preview-frame").evaluate((el) => el.getBoundingClientRect().width);
  await page.screenshot({ path: shot("workbench-preview-desktop") });
  await page.getByRole("button", { name: "移动 375px" }).click();
  await expect(page.getByTestId("preview-pane")).toHaveAttribute("data-preview-width", "mobile");
  const mobileWidth = await page.getByTestId("preview-frame").evaluate((el) => el.getBoundingClientRect().width);
  await page.screenshot({ path: shot("workbench-preview-mobile") });
  result.cases["E2E-4"] = {
    result: mobileWidth <= 376 && mobileWidth > 300 ? "PASS" : "FAIL",
    desktopWidth,
    mobileWidth,
    sandbox: await page.getByTestId("preview-iframe").getAttribute("sandbox"),
  };
  await page.getByRole("button", { name: "桌面" }).click();

  // Code pane reachability
  await page.getByRole("tab", { name: "代码" }).click();
  await expect(page.getByTestId("code-pane")).toBeVisible();
  const codeReachable = await page.getByTestId("code-source").evaluate((el) => {
    const style = getComputedStyle(el);
    const canScroll = el.scrollWidth > el.clientWidth;
    const wraps =
      style.whiteSpace.includes("pre-wrap") ||
      style.overflowWrap === "anywhere" ||
      style.overflowWrap === "break-word";
    return { canScroll, wraps, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  await page.screenshot({ path: shot("workbench-code-pane") });
  result.measurements.codePane = codeReachable;

  // Keyboard reachability + focus rings on tabs / width toggle
  await page.getByRole("tab", { name: "预览" }).click();
  await page.locator("body").focus();
  const reached = { codeTab: false, widthToggle: false, followUp: false };
  for (let i = 0; i < 50; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { kind: "none" };
      const role = el.getAttribute("role");
      const testid = el.getAttribute("data-testid");
      const name = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
      return { kind: role || el.tagName, testid, name, classList: [...el.classList] };
    });
    if (info.kind === "tab" && info.name === "代码") {
      reached.codeTab = true;
      result.a11y.codeTabFocus = await focusRingOn(page.getByRole("tab", { name: "代码" }));
    }
    if (info.name === "移动 375px" || info.name === "桌面" || info.testid === "preview-width-toggle") {
      reached.widthToggle = true;
    }
    if (info.name.includes("后续") || info.testid === "follow-up-input") {
      reached.followUp = true;
    }
  }
  result.cases["E2E-8-keyboard"] = reached;
  await page.screenshot({ path: shot("workbench-focus-tab") });

  // Replay banner
  await page.goto(`${BASE}/projects/${projectId}?provider=replay`, { waitUntil: "networkidle" });
  const replayVisible = await page.getByTestId("ux-banner-replay").isVisible().catch(() => false);
  const replayText = replayVisible
    ? await page.getByTestId("ux-banner-replay").innerText()
    : null;
  await page.screenshot({ path: shot("workbench-replay-banner") });
  result.cases["E2E-6-replay"] = { result: replayVisible && /演示回放/.test(replayText ?? "") ? "PASS" : "FAIL", text: replayText };

  // Reduced motion
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/projects/${projectId}`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "代码" }).click();
  await page.getByRole("tab", { name: "预览" }).click();
  const motion = await page.evaluate(() => {
    const samples = [
      ...document.querySelectorAll(
        ".atoms-running-pulse, .atoms-tab-btn, .atoms-expand-panel, [data-motion]",
      ),
    ];
    const pulse = document.createElement("span");
    pulse.className = "atoms-running-pulse";
    document.body.appendChild(pulse);
    const pulseDuration = getComputedStyle(pulse).animationDuration;
    pulse.remove();
    return {
      pulseDuration,
      samples: samples.map((el) => {
        const style = getComputedStyle(el);
        return {
          animation: style.animationName,
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
        };
      }),
    };
  });
  await page.screenshot({ path: shot("workbench-reduced-motion") });
  result.cases["E2E-5"] = {
    result:
      motion.pulseDuration === "0s" || motion.pulseDuration === "0s, 0s" ? "PASS" : "FAIL",
    motion,
  };
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Follow-up incremental iteration (E2E-1)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await prompt.fill("做一个简洁的待办清单应用");
  await submit.click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 20_000 });
  const newProjectId = new URL(page.url()).pathname.split("/").at(-1);
  await expect(page.getByTestId("agent-card-engineer").getByText("已完成")).toBeVisible({
    timeout: 45_000,
  });
  const followUp = page.getByRole("textbox", { name: "后续需求" });
  const send = page.getByTestId("follow-up-send");
  await expect(followUp).toBeVisible();
  await expect(send).toBeDisabled();
  await followUp.fill("为每项待办加入优先级标签");
  await expect(send).toBeEnabled();
  const previousRunId = await page.getByTestId("workbench-score-badge").getAttribute("data-run-id");
  await page.screenshot({ path: shot("workbench-follow-up-ready") });
  await send.click();
  await expect(send).toBeDisabled();
  await page.screenshot({ path: shot("workbench-follow-up-pending") });
  await expect(page.getByTestId("agent-card-engineer").getByText("已完成")).toBeVisible({
    timeout: 45_000,
  });
  await expect
    .poll(async () => page.getByTestId("workbench-score-badge").getAttribute("data-run-id"))
    .not.toBe(previousRunId);
  await page.getByRole("tab", { name: "代码" }).click();
  const codeHasPriority = await page.getByTestId("code-source").innerText().then((t) => t.includes("优先级"));
  await page.screenshot({ path: shot("workbench-after-follow-up") });
  result.cases["E2E-1"] = {
    result: codeHasPriority ? "PASS" : "FAIL",
    previousRunId,
    newRunId: await page.getByTestId("workbench-score-badge").getAttribute("data-run-id"),
    codeHasPriority,
  };

  // Persistence reload (E2E-7)
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("follow-up-form")).toBeVisible();
  await page.screenshot({ path: shot("workbench-persistence-reload") });
  result.cases["E2E-7"] = {
    result: "PASS",
    followUpVisible: true,
    runId: await page.getByTestId("workbench-score-badge").getAttribute("data-run-id"),
  };

  // QA rounds exhaustion
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /描述你想生成的应用/ }).fill("持续失败演示 中文待办清单");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\//, { timeout: 20_000 });
  const qaCard = page.getByTestId("agent-card-qa");
  await expect(qaCard).toHaveAttribute("data-status", "completed", { timeout: 60_000 });
  const capVisible = await page.getByText("已达修复上限").first().isVisible();
  const qaRoundsAttr = await page.getByTestId("workbench-qa-rounds").getAttribute("data-run-qa-rounds");
  await page.screenshot({ path: shot("workbench-qa-cap") });
  result.cases["E2E-6-qa-cap"] = {
    result: capVisible && qaRoundsAttr === "3" ? "PASS" : "FAIL",
    capVisible,
    qaRoundsAttr,
  };

  // Share read-only (E2E-3)
  await page.goto(`${BASE}/projects/${newProjectId}`, { waitUntil: "networkidle" });
  const shareButton = page.getByRole("button", { name: "创建只读分享链接" });
  if (await shareButton.isEnabled()) {
    await shareButton.click();
  }
  const shareLink = page.getByRole("link", { name: /\/share\// });
  await expect(shareLink).toBeVisible({ timeout: 15_000 });
  const shareUrl = await shareLink.getAttribute("href");
  await page.screenshot({ path: shot("workbench-share-minted") });

  const visitor = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const visitorPage = await visitor.newPage();
  const visitorUrls = [];
  visitorPage.on("request", (req) => {
    visitorUrls.push(req.url());
    if (isBlocked(req.url())) result.cdn.offenders.push(req.url());
  });
  await visitorPage.goto(`${BASE}${shareUrl}`, { waitUntil: "networkidle" });
  await expect(visitorPage.getByText("只读分享")).toBeVisible();
  const followUpCount = await visitorPage.getByTestId("follow-up-form").count();
  const zipCount = await visitorPage.getByRole("button", { name: "下载 ZIP" }).count();
  const shareBtnCount = await visitorPage.getByRole("button", { name: "创建只读分享链接" }).count();
  await visitorPage.getByRole("tab", { name: "预览" }).click();
  await expect(visitorPage.getByTestId("preview-iframe")).toBeVisible({ timeout: 60_000 });
  await visitorPage.screenshot({ path: shot("share-read-only-polish") });
  result.cases["E2E-3"] = {
    result: followUpCount === 0 && zipCount === 0 && shareBtnCount === 0 ? "PASS" : "FAIL",
    followUpCount,
    zipCount,
    shareBtnCount,
    shareUrl,
    iframeTitle: await visitorPage.getByTestId("preview-iframe").getAttribute("title"),
    sandbox: await visitorPage.getByTestId("preview-iframe").getAttribute("sandbox"),
  };
  result.measurements.share = await measureOverflow(visitorPage);
  await visitor.close();

  // CDN audit summary (E2E-2)
  result.cdn.offenders = [...new Set(result.cdn.offenders)];
  result.cases["E2E-2"] = {
    result: result.cdn.offenders.length === 0 ? "PASS" : "FAIL",
    requestCount: result.cdn.urls.length + visitorUrls.length,
    offenders: result.cdn.offenders,
  };

  // Workbench overflow at 375
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/projects/${newProjectId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: shot("workbench-375") });
  result.measurements.workbench375 = await measureOverflow(page);

  // Exploratory: rapid follow-up double click attempt
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/projects/${newProjectId}`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "后续需求" }).fill("再试一次双击");
  const send2 = page.getByTestId("follow-up-send");
  await send2.dblclick().catch(() => null);
  await page.screenshot({ path: shot("probe-double-follow-up") });
  result.probes.doubleFollowUp = {
    disabledAfter: await send2.isDisabled(),
  };

  // Dark scheme spot-check
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  result.a11y.darkContrast = await contrastSample(page);
  await page.screenshot({ path: shot("home-dark") });
  await page.goto(`${BASE}/projects/${newProjectId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: shot("workbench-dark") });
  result.a11y.workbenchDarkContrast = await contrastSample(page);

  writeFileSync(path.join(OUT, "journey-results.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, cases: result.cases, probes: result.probes, cdnOffenders: result.cdn.offenders.length }, null, 2));
} catch (error) {
  await page.screenshot({ path: shot("fatal-error"), fullPage: true }).catch(() => null);
  writeFileSync(
    path.join(OUT, "journey-results.json"),
    JSON.stringify({ ok: false, error: String(error?.stack || error), result }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
