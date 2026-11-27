import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildStandaloneReviewHtml,
  bundlePreviewFiles,
} from "@/lib/preview/bundle";
import {
  computeFilesSha256,
  validateVitestCodeSafety,
  type ReviewAction,
  type ReviewCaseEvidence,
  type ReviewCasePlan,
  type ReviewStepTrace,
  type SandboxReviewPlan,
  type SandboxReviewReport,
} from "./review-types";
import type { SandboxCommandResult, SandboxFile } from "./types";

const execFileAsync = promisify(execFile);
const VITEST_TIMEOUT_MS = 18_000;
const ACTION_TIMEOUT_MS = 4_000;
const MAX_SCREENSHOT_DATA_URL_LEN = 110_000;

type PlaywrightChromium = {
  launch: (options?: Record<string, unknown>) => Promise<PlaywrightBrowser>;
  executablePath?: () => string;
};

type PlaywrightBrowser = {
  newContext: (options?: Record<string, unknown>) => Promise<PlaywrightContext>;
  close: () => Promise<void>;
};

type PlaywrightContext = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

type PlaywrightLocator = {
  first: () => PlaywrightLocator;
  count: () => Promise<number>;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string, options?: { timeout?: number }) => Promise<void>;
  isVisible: () => Promise<boolean>;
};

type PlaywrightPage = {
  on: (event: string, listener: (arg: unknown) => void) => void;
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  reload: (options?: Record<string, unknown>) => Promise<unknown>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  keyboard: { press: (key: string) => Promise<void> };
  getByRole: (role: string, options?: { name?: string | RegExp }) => PlaywrightLocator;
  getByText: (text: string | RegExp) => PlaywrightLocator;
  getByLabel: (text: string | RegExp) => PlaywrightLocator;
  getByPlaceholder: (text: string | RegExp) => PlaywrightLocator;
  locator: (selector: string) => PlaywrightLocator;
  screenshot: (options?: Record<string, unknown>) => Promise<Buffer>;
};

function loadPlaywrightChromium(): PlaywrightChromium | null {
  try {
    const nodeModule = process.getBuiltinModule("module") as
      | typeof import("node:module")
      | undefined;
    if (!nodeModule) return null;
    const req = nodeModule.createRequire(`${process.cwd()}/package.json`);
    for (const modName of ["@playwright/test", "playwright"]) {
      try {
        const mod = req(modName) as { chromium?: PlaywrightChromium };
        if (mod?.chromium) {
          const execPath = mod.chromium.executablePath?.();
          if (execPath && !fs.existsSync(execPath)) {
            continue;
          }
          return mod.chromium;
        }
      } catch {
        // Try next package name.
      }
    }
    return null;
  } catch {
    return null;
  }
}

function resolveVitestBin(): string | null {
  const candidate = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vitest.cmd" : "vitest",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function sanitizeRelativePath(filePath: string): string | null {
  const normalized = path.posix
    .normalize(filePath.replace(/\\/g, "/"))
    .replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("/../")) {
    return null;
  }
  return normalized;
}

function compactText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 360);
}

function describeAction(action: ReviewAction): string {
  switch (action.type) {
    case "press":
      return action.count && action.count > 1
        ? `按键 ${action.key} (x${action.count})`
        : `按键 ${action.key}`;
    case "click":
      return action.text
        ? `点击「${action.text}」`
        : action.selector
          ? `点击 ${action.selector}`
          : `点击 ${action.role ?? "button"}`;
    case "fill":
      return `输入「${action.text.slice(0, 32)}」`;
    case "wait":
      return `等待 ${action.ms}ms`;
    case "reload":
      return "刷新页面 (page.reload)";
    case "assert": {
      const parts: string[] = [];
      if (action.expectText) parts.push(`包含文案「${action.expectText}」`);
      if (action.expectVisible) parts.push(`元素可见「${action.expectVisible}」`);
      if (action.expectTextChanged) parts.push("界面状态发生变化");
      if (action.expectStorageChanged) parts.push("持久化存储已写入");
      if (action.expectNoErrors) parts.push("无运行/控制台报错");
      return `断言：${parts.join("、") || "状态有效"}`;
    }
  }
}

async function readPageState(page: PlaywrightPage): Promise<{
  text: string;
  storage: Record<string, string>;
  probeErrors: string[];
}> {
  return page.evaluate(() => {
    const root = document.getElementById("root");
    const text = (root?.innerText || root?.textContent || "").trim();
    const storage: Record<string, string> = {};
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key) {
          storage[key] = (window.localStorage.getItem(key) ?? "").slice(0, 500);
        }
      }
    } catch {
      // Ignore storage read failures.
    }
    const probeErrors = Array.isArray(
      (window as unknown as { __atomsProbeErrors?: unknown }).__atomsProbeErrors,
    )
      ? ((window as unknown as { __atomsProbeErrors: string[] }).__atomsProbeErrors).slice(0, 20)
      : [];
    return { text, storage, probeErrors };
  });
}

async function resolveClickTarget(
  page: PlaywrightPage,
  action: Extract<ReviewAction, { type: "click" }>,
): Promise<PlaywrightLocator | null> {
  if (action.selector) {
    const loc = page.locator(action.selector).first();
    if ((await loc.count()) > 0) return loc;
  }
  if (action.role && action.text) {
    const exact = page.getByRole(action.role, { name: action.text }).first();
    if ((await exact.count()) > 0) return exact;
  }
  if (action.text) {
    const byBtn = page.getByRole("button", { name: action.text }).first();
    if ((await byBtn.count()) > 0) return byBtn;
    const byText = page.getByText(action.text).first();
    if ((await byText.count()) > 0) return byText;
  }
  if (action.role) {
    const byRole = page.getByRole(action.role).first();
    if ((await byRole.count()) > 0) return byRole;
  }
  return null;
}

async function resolveFillTarget(
  page: PlaywrightPage,
  action: Extract<ReviewAction, { type: "fill" }>,
): Promise<PlaywrightLocator | null> {
  if (action.selector) {
    const loc = page.locator(action.selector).first();
    if ((await loc.count()) > 0) return loc;
  }
  if (action.label) {
    const loc = page.getByLabel(action.label).first();
    if ((await loc.count()) > 0) return loc;
  }
  if (action.placeholder) {
    const loc = page.getByPlaceholder(action.placeholder).first();
    if ((await loc.count()) > 0) return loc;
  }
  const fallback = page.locator('input:not([type="checkbox"]):not([type="radio"]), textarea').first();
  if ((await fallback.count()) > 0) return fallback;
  return null;
}

async function startReviewHtmlServer(
  html: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to bind ephemeral review HTTP server");
  }

  return {
    url: `http://127.0.0.1:${addr.port}/`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

async function runPlaywrightCase(
  browser: PlaywrightBrowser,
  url: string,
  casePlan: ReviewCasePlan,
): Promise<{
  ok: boolean;
  steps: ReviewStepTrace[];
  screenshotDataUrl?: string;
  screenshotLabel?: string;
  consoleErrors: string[];
  pageErrors: string[];
  storageBefore: Record<string, string>;
  storageAfter: Record<string, string>;
  summary: string;
}> {
  const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
  });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const steps: ReviewStepTrace[] = [];

  try {
    const page = await context.newPage();
    page.on("console", (msg: unknown) => {
      const m = msg as { type?: () => string; text?: () => string };
      if (m.type?.() === "error" && consoleErrors.length < 20) {
        consoleErrors.push(String(m.text?.() ?? "Console error").slice(0, 400));
      }
    });
    page.on("pageerror", (err: unknown) => {
      if (pageErrors.length < 20) {
        const text = err instanceof Error ? err.message : String(err);
        pageErrors.push(text.slice(0, 400));
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });
    try {
      await page.waitForSelector('html[data-atoms-painted="1"]', {
        timeout: 4_000,
      });
    } catch {
      // Allow inspection even if paint beacon timed out; readPageState will capture empty text.
    }
    await page.waitForTimeout(120);

    const initialState = await readPageState(page);
    const initialText = compactText(initialState.text);
    const storageBefore = initialState.storage;
    let lastText = initialText;
    let anyChangeObserved = false;
    let allStepsOk = true;

    const actionList = casePlan.steps ?? [];
    for (let i = 0; i < actionList.length; i += 1) {
      const action = actionList[i]!;
      const stepStart = Date.now();
      const label = describeAction(action);
      const before = lastText;

      try {
        if (action.type === "press") {
          const count = action.count ?? 1;
          for (let k = 0; k < count; k += 1) {
            await page.keyboard.press(action.key);
            await page.waitForTimeout(45);
          }
        } else if (action.type === "click") {
          const target = await resolveClickTarget(page, action);
          if (!target) {
            throw new Error(`未找到可点击目标：${label}`);
          }
          await target.click({ timeout: ACTION_TIMEOUT_MS });
          await page.waitForTimeout(80);
        } else if (action.type === "fill") {
          const target = await resolveFillTarget(page, action);
          if (!target) {
            throw new Error(`未找到输入框目标：${label}`);
          }
          await target.fill(action.text, { timeout: ACTION_TIMEOUT_MS });
          await page.waitForTimeout(60);
        } else if (action.type === "wait") {
          await page.waitForTimeout(Math.min(action.ms, 2_000));
        } else if (action.type === "reload") {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 10_000 });
          try {
            await page.waitForSelector('html[data-atoms-painted="1"]', {
              timeout: 4_000,
            });
          } catch {
            // Continue so assert catches blank screen.
          }
          await page.waitForTimeout(120);
        } else if (action.type === "assert") {
          const cur = await readPageState(page);
          const curText = compactText(cur.text);
          const curStorage = cur.storage;
          const allErrors = [...consoleErrors, ...pageErrors, ...cur.probeErrors];
          const failures: string[] = [];

          if (action.expectNoErrors && allErrors.length > 0) {
            failures.push(`检测到运行时报错：${allErrors.slice(0, 2).join("；")}`);
          }
          if (
            action.expectText &&
            !cur.text.toLowerCase().includes(action.expectText.toLowerCase())
          ) {
            failures.push(`页面未包含预期文案「${action.expectText}」`);
          }
          if (action.expectVisible) {
            const loc = page.getByText(action.expectVisible).first();
            const vis = (await loc.count()) > 0 && (await loc.isVisible());
            if (!vis) {
              failures.push(`预期元素不可见「${action.expectVisible}」`);
            }
          }
          if (
            action.expectTextChanged &&
            !anyChangeObserved &&
            curText === initialText
          ) {
            failures.push("交互前后页面内容未发生任何变化");
          }
          if (action.expectStorageChanged) {
            const hasStorage = Object.keys(curStorage).length > 0;
            const changed =
              JSON.stringify(curStorage) !== JSON.stringify(storageBefore);
            if (!hasStorage && !changed) {
              failures.push("localStorage 未检测到任何持久化状态写入");
            }
          }
          if (failures.length > 0) {
            throw new Error(failures.join("；"));
          }
        }

        const afterState = await readPageState(page);
        const after = compactText(afterState.text);
        const changed = after !== before;
        if (changed) anyChangeObserved = true;
        lastText = after;
        steps.push({
          stepIndex: i,
          action: label,
          ok: true,
          beforeSummary: before,
          afterSummary: after,
          changed,
          durationMs: Math.max(1, Date.now() - stepStart),
        });
      } catch (err) {
        allStepsOk = false;
        const message = err instanceof Error ? err.message : String(err);
        steps.push({
          stepIndex: i,
          action: label,
          ok: false,
          beforeSummary: before,
          error: message.slice(0, 400),
          durationMs: Math.max(1, Date.now() - stepStart),
        });
        break;
      }
    }

    const finalState = await readPageState(page);
    for (const err of finalState.probeErrors) {
      if (!pageErrors.includes(err) && pageErrors.length < 20) {
        pageErrors.push(err);
      }
    }

    let screenshotDataUrl: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 58 });
      const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
      if (dataUrl.length <= MAX_SCREENSHOT_DATA_URL_LEN) {
        screenshotDataUrl = dataUrl;
      }
    } catch {
      // Best-effort screenshot capture.
    }

    const ok = allStepsOk && consoleErrors.length === 0 && pageErrors.length === 0;
    const failedStep = steps.find((s) => !s.ok);
    const summary = ok
      ? `Playwright 真浏览器执行 ${steps.length} 步均通过（${anyChangeObserved ? "观测到真实界面状态变化" : "页面稳定无报错"}）`
      : failedStep?.error
        ? `Playwright 交互失败（${failedStep.action}）：${failedStep.error}`
        : `Playwright 运行时检测到错误：${[...pageErrors, ...consoleErrors].slice(0, 2).join("；")}`;

    return {
      ok,
      steps,
      screenshotDataUrl,
      screenshotLabel: ok ? "交互验收通过快照" : "交互失败现场快照",
      consoleErrors,
      pageErrors,
      storageBefore,
      storageAfter: finalState.storage,
      summary,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function runIsolatedVitestCase(
  files: SandboxFile[],
  vitestCode: string,
): Promise<{
  ok: boolean;
  command: SandboxCommandResult;
  summary: string;
}> {
  const safety = validateVitestCodeSafety(vitestCode);
  if (!safety.ok) {
    return {
      ok: false,
      command: {
        command: "vitest run __atoms_review__/boundary.test.tsx",
        exitCode: 1,
        stdout: "",
        stderr: `安全策略拦截：${safety.reason}`,
        durationMs: 1,
      },
      summary: `动态单测未通过安全策略：${safety.reason}`,
    };
  }

  const vitestBin = resolveVitestBin();
  if (!vitestBin) {
    return {
      ok: false,
      command: {
        command: "vitest run __atoms_review__/boundary.test.tsx",
        exitCode: 127,
        stdout: "",
        stderr: "vitest binary not found",
        durationMs: 1,
      },
      summary: "当前运行环境缺少 vitest 可执行文件",
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-rev-vt-"));
  const started = Date.now();
  try {
    const nodeModulesSrc = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "node_modules",
    );
    if (fs.existsSync(nodeModulesSrc)) {
      fs.symlinkSync(nodeModulesSrc, path.join(tmpDir, "node_modules"), "dir");
    }

    for (const file of files) {
      const rel = sanitizeRelativePath(file.path);
      if (!rel) continue;
      const target = path.join(/*turbopackIgnore: true*/ tmpDir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content, "utf8");
    }

    const testDir = path.join(tmpDir, "__atoms_review__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "boundary.test.tsx"), vitestCode, "utf8");

    const vitestConfig = `import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["__atoms_review__/**/*.test.tsx"],
    globals: false,
  },
});
`;
    fs.writeFileSync(
      path.join(tmpDir, "vitest.review.config.mjs"),
      vitestConfig,
      "utf8",
    );

    let exitCode = 0;
    let stdout = "";
    let stderr = "";
    try {
      const res = await execFileAsync(
        vitestBin,
        ["run", "--config", "vitest.review.config.mjs", "--reporter=verbose"],
        {
          cwd: tmpDir,
          timeout: VITEST_TIMEOUT_MS,
          maxBuffer: 512 * 1024,
          env: {
            PATH: process.env.PATH ?? "",
            NODE_ENV: "test",
          },
        },
      );
      stdout = String(res.stdout ?? "").trim();
      stderr = String(res.stderr ?? "").trim();
    } catch (err) {
      const execErr = err as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      exitCode = typeof execErr.code === "number" ? execErr.code : 1;
      stdout = String(execErr.stdout ?? "").trim();
      stderr = String(execErr.stderr ?? execErr.message ?? "vitest failed").trim();
    }

    const durationMs = Math.max(1, Date.now() - started);
    const ok = exitCode === 0;
    const command: SandboxCommandResult = {
      command: "vitest run __atoms_review__/boundary.test.tsx",
      exitCode,
      stdout: stdout.slice(-2_000),
      stderr: stderr.slice(-2_000),
      durationMs,
    };

    const failLine = [stderr, stdout]
      .join("\n")
      .split(/\r?\n/)
      .find((line) => /AssertionError|FAIL|Error:|expected/i.test(line));

    return {
      ok,
      command,
      summary: ok
        ? `Vitest 隔离边界单测通过 (${durationMs}ms)`
        : `Vitest 边界单测失败：${(failLine ?? "断言未通过").trim().slice(0, 220)}`,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort temp cleanup.
    }
  }
}

/**
 * Runs real Playwright headless Chromium journeys AND isolated Vitest boundary
 * tests inside local Node temporary workspaces, binding conclusions to the
 * exact SHA-256 of the reviewed file bundle.
 */
export async function runLocalNodeReviewer(
  files: SandboxFile[],
  plan: SandboxReviewPlan,
  expectedSha256?: string,
): Promise<SandboxReviewReport | null> {
  const started = Date.now();
  const artifactSha256 = await computeFilesSha256(files);
  if (expectedSha256 && expectedSha256 !== artifactSha256) {
    return {
      backend: "local-node-sandbox",
      isolated: true,
      artifactSha256,
      ok: false,
      cases: plan.cases.map((c) => ({
        criterion: c.criterion,
        strategy: c.strategy,
        status: "not_performed",
        summary: "目标产物 SHA-256 与待复核包不一致，拒绝执行",
        steps: [],
        consoleErrors: [],
        pageErrors: [],
        durationMs: 1,
      })),
      commands: [],
      errors: ["Artifact SHA-256 mismatch"],
      durationMs: Math.max(1, Date.now() - started),
    };
  }

  const needsPlaywright = plan.cases.some(
    (c) => (c.strategy === "playwright" || c.strategy === "hybrid") && (c.steps?.length ?? 0) > 0,
  );
  const needsVitest = plan.cases.some(
    (c) => (c.strategy === "vitest" || c.strategy === "hybrid") && Boolean(c.vitestCode?.trim()),
  );

  const chromium = needsPlaywright ? loadPlaywrightChromium() : null;
  const vitestBin = needsVitest ? resolveVitestBin() : null;

  if (!chromium && !vitestBin) {
    return null;
  }

  const commands: SandboxCommandResult[] = [];
  const errors: string[] = [];
  const cases: ReviewCaseEvidence[] = [];

  let browser: PlaywrightBrowser | null = null;
  let htmlServer: { url: string; close: () => Promise<void> } | null = null;

  try {
    if (needsPlaywright && chromium) {
      const bundleStart = Date.now();
      const bundled = await bundlePreviewFiles(files);
      if (!bundled.ok) {
        errors.push(bundled.messageZh);
        commands.push({
          command: "esbuild-wasm bundle --review",
          exitCode: 1,
          stdout: "",
          stderr: bundled.messageZh,
          durationMs: Math.max(1, Date.now() - bundleStart),
        });
      } else {
        const html = buildStandaloneReviewHtml(
          bundled.js,
          bundled.css,
          bundled.vendorJs,
          bundled.tailwindJs,
        );
        htmlServer = await startReviewHtmlServer(html);
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        commands.push({
          command: "playwright chromium --headless --viewport 960x640",
          exitCode: 0,
          stdout: `Bundled ${files.length} files & launched Chromium at ${htmlServer.url}`,
          stderr: "",
          durationMs: Math.max(1, Date.now() - bundleStart),
        });
      }
    }

    for (const casePlan of plan.cases) {
      const caseStart = Date.now();
      const wantPw =
        (casePlan.strategy === "playwright" || casePlan.strategy === "hybrid") &&
        (casePlan.steps?.length ?? 0) > 0;
      const wantVt =
        (casePlan.strategy === "vitest" || casePlan.strategy === "hybrid") &&
        Boolean(casePlan.vitestCode?.trim());

      let pwResult: Awaited<ReturnType<typeof runPlaywrightCase>> | null = null;
      let vtResult: Awaited<ReturnType<typeof runIsolatedVitestCase>> | null = null;

      if (wantPw && browser && htmlServer) {
        pwResult = await runPlaywrightCase(browser, htmlServer.url, casePlan);
      }

      if (wantVt && casePlan.vitestCode) {
        vtResult = await runIsolatedVitestCase(files, casePlan.vitestCode);
        commands.push(vtResult.command);
      }

      if (!pwResult && !vtResult) {
        cases.push({
          criterion: casePlan.criterion,
          strategy: casePlan.strategy,
          status: "not_performed",
          summary: wantPw && !browser
            ? "Playwright 浏览器未就绪，本次未能执行交互复核"
            : "缺少可执行的交互步骤或边界测试代码",
          steps: [],
          consoleErrors: [],
          pageErrors: [],
          durationMs: Math.max(1, Date.now() - caseStart),
        });
        continue;
      }

      const ok = (pwResult ? pwResult.ok : true) && (vtResult ? vtResult.ok : true);
      const summaryParts = [pwResult?.summary, vtResult?.summary].filter(Boolean);

      cases.push({
        criterion: casePlan.criterion,
        strategy: casePlan.strategy,
        status: ok ? "passed" : "failed",
        summary: summaryParts.join("；").slice(0, 600),
        steps: pwResult?.steps ?? [],
        ...(pwResult?.screenshotDataUrl
          ? {
              screenshotDataUrl: pwResult.screenshotDataUrl,
              screenshotLabel: pwResult.screenshotLabel,
            }
          : {}),
        ...(vtResult ? { vitestCommand: vtResult.command } : {}),
        consoleErrors: pwResult?.consoleErrors ?? [],
        pageErrors: pwResult?.pageErrors ?? [],
        ...(pwResult ? { storageBefore: pwResult.storageBefore, storageAfter: pwResult.storageAfter } : {}),
        durationMs: Math.max(1, Date.now() - caseStart),
      });
    }

    const ok =
      errors.length === 0 &&
      cases.every((c) => c.status !== "failed");

    return {
      backend: "local-node-sandbox",
      isolated: true,
      artifactSha256,
      ok,
      cases,
      commands,
      errors,
      durationMs: Math.max(1, Date.now() - started),
    };
  } finally {
    await browser?.close().catch(() => undefined);
    await htmlServer?.close().catch(() => undefined);
  }
}
