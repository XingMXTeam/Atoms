import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as esbuild from "esbuild";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const BRIDGE_TOKEN = (process.env.SANDBOX_BRIDGE_TOKEN || "").trim();
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CMD_TIMEOUT_MS = 18_000;
const ACTION_TIMEOUT_MS = 4_000;
const MAX_SCREENSHOT_DATA_URL_LEN = 110_000;

const ASSETS_DIR = process.env.ATOMS_PREVIEW_ASSETS_DIR || path.resolve(__dirname, "../public/preview");

const ALLOWED_VENDOR = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
]);

const VENDOR_SHIM = `const v = globalThis.__ATOMS_PREVIEW_VENDOR__;
if (!v) throw new Error("Atoms preview vendor missing");
export default v.default ?? v;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createRef, forwardRef, isValidElement,
  lazy, memo, startTransition, unstable_act, use, useActionState, useCallback,
  useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle,
  useInsertionEffect, useLayoutEffect, useMemo, useOptimistic, useReducer, useRef,
  useState, useSyncExternalStore, useTransition, version,
  jsx, jsxs, jsxDEV, createRoot, hydrateRoot,
} = v;
`;

const FORBIDDEN_VITEST_PATTERNS = [
  {
    re: /\b(?:node:)?(?:child_process|fs|net|http|https|http2|dgram|tls|dns|cluster|worker_threads|vm|v8|inspector|os|perf_hooks)\b/,
    reason: "禁止在动态单测中引用 Node 系统/网络/文件系统模块",
  },
  {
    re: /\b(?:process\.env|process\.exit|process\.kill|process\.binding|globalThis\.process)\b/,
    reason: "禁止访问 process 环境或进程控制接口",
  },
  { re: /\b(?:eval|Function)\s*\(/, reason: "禁止使用 eval 或 Function 动态代码执行" },
  { re: /\brequire\s*\(/, reason: "动态单测必须使用 ESM import，禁止 require()" },
  { re: /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/, reason: "动态单测禁止发起网络请求" },
  { re: /https?:\/\//i, reason: "动态单测禁止包含外部 URL" },
  { re: /from\s+['"]\.\.\/\.\.\//, reason: "禁止越界导入工作区外部文件" },
];

const ALLOWED_VITEST_PACKAGES = new Set([
  "vitest",
  "@testing-library/react",
  "react",
  "react-dom",
  "react-dom/client",
  "react-dom/test-utils",
]);

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}

function sanitizeRelativePath(p) {
  const norm = path.posix.normalize(String(p || "").replace(/\\/g, "/")).replace(/^\/+/, "");
  if (!norm || norm.startsWith("..") || norm.includes("/../")) return null;
  return norm;
}

function computeFilesSha256(files) {
  const canonical = [...files]
    .map((f) => ({ path: normalizePath(f.path), content: String(f.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}\0${f.content}\0`)
    .join("");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function validateVitestCodeSafety(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return { ok: false, reason: "测试代码为空" };
  if (trimmed.length > 12_000) return { ok: false, reason: "测试代码超过 12KB 限制" };
  for (const { re, reason } of FORBIDDEN_VITEST_PATTERNS) {
    if (re.test(trimmed)) return { ok: false, reason };
  }
  const importRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(trimmed)) !== null) {
    const spec = match[1] || "";
    if (spec.startsWith("./") || spec.startsWith("../src/")) continue;
    if (spec.startsWith("../")) return { ok: false, reason: `禁止导入非 src 相对路径 "${spec}"` };
    if (!ALLOWED_VITEST_PACKAGES.has(spec)) {
      return { ok: false, reason: `禁止导入未授权依赖 "${spec}"` };
    }
  }
  return { ok: true };
}

function loadAssetText(rel) {
  const target = path.join(ASSETS_DIR, rel);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function resolveBin(name) {
  for (const base of [__dirname, path.resolve(__dirname, "..")]) {
    const candidate = path.join(base, "node_modules", ".bin", name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveNodeModulesDir() {
  for (const base of [__dirname, path.resolve(__dirname, "..")]) {
    const candidate = path.join(base, "node_modules");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function writeWorkspaceFiles(tmpDir, files) {
  const nm = resolveNodeModulesDir();
  if (nm) fs.symlinkSync(nm, path.join(tmpDir, "node_modules"), "dir");
  const written = [];
  for (const f of files) {
    const rel = sanitizeRelativePath(f.path);
    if (!rel) continue;
    const target = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(f.content ?? ""), "utf8");
    written.push(rel);
  }
  return written;
}

async function runTscVerify(files) {
  const started = Date.now();
  const tscBin = resolveBin("tsc");
  if (!tscBin) {
    return {
      ok: false,
      commands: [],
      errors: ["Sandbox container missing tsc binary"],
      durationMs: Math.max(1, Date.now() - started),
    };
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-ctr-tsc-"));
  try {
    const written = writeWorkspaceFiles(tmpDir, files);
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: false,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        isolatedModules: true,
        types: [],
      },
      include: ["src/**/*"],
    };
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

    const cmdStart = Date.now();
    let exitCode = 0;
    let stdout = "";
    let stderr = "";
    try {
      const res = await execFileAsync(tscBin, ["--noEmit", "-p", "tsconfig.json"], {
        cwd: tmpDir,
        timeout: CMD_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
        env: { PATH: process.env.PATH || "", NODE_ENV: "production" },
      });
      stdout = String(res.stdout || "").trim();
      stderr = String(res.stderr || "").trim();
    } catch (err) {
      exitCode = typeof err?.code === "number" ? err.code : 1;
      stdout = String(err?.stdout || "").trim();
      stderr = String(err?.stderr || err?.message || "tsc failed").trim();
    }
    const cmdMs = Math.max(1, Date.now() - cmdStart);
    const combined = [stdout, stderr].filter(Boolean).join("\n");
    const parsedErrors = exitCode === 0
      ? []
      : combined
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => /error TS\d+:/.test(l))
          .slice(0, 12);
    const errors = exitCode === 0
      ? []
      : parsedErrors.length > 0
        ? parsedErrors
        : [combined.slice(0, 400) || "TypeScript 编译校验失败"];

    return {
      ok: exitCode === 0,
      commands: [
        {
          command: "tsc --noEmit -p tsconfig.json",
          exitCode,
          stdout: (stdout || (exitCode === 0 ? `Checked ${written.length} files cleanly.` : "")).slice(0, 2000),
          stderr: stderr.slice(0, 2000),
          durationMs: cmdMs,
        },
      ],
      errors,
      durationMs: Math.max(1, Date.now() - started),
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function bundleToStandaloneHtml(files) {
  const fileMap = new Map(files.map((f) => [normalizePath(f.path), String(f.content ?? "")]));
  const preferred = ["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js", "src/App.tsx"];
  const entry = preferred.find((p) => fileMap.has(p)) || [...fileMap.keys()].find((k) => /\.(tsx|ts|jsx|js)$/.test(k));
  if (!entry) throw new Error("没有可打包的入口文件");

  const resolveRel = (from, req) => {
    const base = normalizePath(from).split("/");
    base.pop();
    for (const part of req.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") base.pop();
      else base.push(part);
    }
    const joined = base.join("/");
    for (const cand of [joined, `${joined}.tsx`, `${joined}.ts`, `${joined}.jsx`, `${joined}.js`, `${joined}/index.tsx`, `${joined}/index.ts`]) {
      const k = normalizePath(cand);
      if (fileMap.has(k)) return k;
    }
    return null;
  };

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    plugins: [
      {
        name: "atoms-virtual",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return { path: normalizePath(args.path), namespace: "virtual" };
            if (ALLOWED_VENDOR.has(args.path)) return { path: args.path, namespace: "vendor" };
            if (args.path.startsWith(".") || args.path.startsWith("/")) {
              const found = resolveRel(args.importer, args.path);
              if (!found) return { errors: [{ text: `找不到模块：${args.path}` }] };
              return { path: found, namespace: "virtual" };
            }
            return { errors: [{ text: `未授权依赖：${args.path}` }] };
          });
          build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
            const contents = fileMap.get(normalizePath(args.path)) || "";
            const loader = args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".jsx")
                  ? "jsx"
                  : args.path.endsWith(".css")
                    ? "css"
                    : "js";
            return { contents, loader };
          });
          build.onLoad({ filter: /.*/, namespace: "vendor" }, () => ({ contents: VENDOR_SHIM, loader: "js" }));
        },
      },
    ],
  });

  const js = (result.outputFiles.find((o) => o.path.endsWith(".js"))?.text || "").replace(/<\/script/gi, "<\\/script");
  const cssParts = [loadAssetText("tailwind.css")];
  for (const out of result.outputFiles) {
    if (out.path.endsWith(".css")) cssParts.push(out.text);
  }
  const css = cssParts.filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");
  const vendorJs = loadAssetText("vendor/runtime.js").replace(/<\/script/gi, "<\\/script");
  const tailwindJs = loadAssetText("vendor/tailwind-browser.js").replace(/<\/script/gi, "<\\/script");
  const probeCapture = `window.__atomsProbeErrors=[];window.addEventListener("error",function(e){if(window.__atomsProbeErrors.length<20)window.__atomsProbeErrors.push(String(e.message||"Runtime error").slice(0,500));});window.addEventListener("unhandledrejection",function(e){if(window.__atomsProbeErrors.length<20)window.__atomsProbeErrors.push(String(e.reason&&e.reason.message||e.reason||"Unhandled rejection").slice(0,500));});`;
  const paintBeacon = `try{(function(){var r=document.getElementById("root");if(!r)return;function done(){var t=(r.innerText||r.textContent||"").trim();if(!t)return false;document.documentElement.setAttribute("data-atoms-painted","1");return true;}if(done())return;var n=0,timer=setInterval(function(){n++;if(done()||n>400)clearInterval(timer);},50);})();}catch(e){}`;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Atoms Sandbox Review</title><style>${css}</style>${tailwindJs ? `<script>${tailwindJs}</script>` : ""}</head><body><div id="root"></div><script>${probeCapture}</script><script>${vendorJs}</script><script>${js}</script><script>${paintBeacon}</script></body></html>`;
}

async function runIsolatedVitest(files, vitestCode) {
  const safety = validateVitestCodeSafety(vitestCode);
  if (!safety.ok) {
    return {
      ok: false,
      command: { command: "vitest run __atoms_review__/boundary.test.tsx", exitCode: 1, stdout: "", stderr: `安全策略拦截：${safety.reason}`, durationMs: 1 },
      summary: `动态单测未通过安全策略：${safety.reason}`,
    };
  }
  const vitestBin = resolveBin("vitest");
  if (!vitestBin) {
    return {
      ok: false,
      command: { command: "vitest run __atoms_review__/boundary.test.tsx", exitCode: 127, stdout: "", stderr: "vitest binary not found", durationMs: 1 },
      summary: "容器内缺少 vitest",
    };
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-ctr-vt-"));
  const started = Date.now();
  try {
    writeWorkspaceFiles(tmpDir, files);
    const testDir = path.join(tmpDir, "__atoms_review__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "boundary.test.tsx"), vitestCode, "utf8");
    fs.writeFileSync(
      path.join(tmpDir, "vitest.review.config.mjs"),
      `import { defineConfig } from "vitest/config";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()], test: { environment: "jsdom", include: ["__atoms_review__/**/*.test.tsx"], globals: false } });\n`,
    );

    let exitCode = 0;
    let stdout = "";
    let stderr = "";
    try {
      const res = await execFileAsync(vitestBin, ["run", "--config", "vitest.review.config.mjs", "--reporter=verbose"], {
        cwd: tmpDir,
        timeout: CMD_TIMEOUT_MS,
        maxBuffer: 512 * 1024,
        env: { PATH: process.env.PATH || "", NODE_ENV: "test" },
      });
      stdout = String(res.stdout || "").trim();
      stderr = String(res.stderr || "").trim();
    } catch (err) {
      exitCode = typeof err?.code === "number" ? err.code : 1;
      stdout = String(err?.stdout || "").trim();
      stderr = String(err?.stderr || err?.message || "vitest failed").trim();
    }
    const durationMs = Math.max(1, Date.now() - started);
    const ok = exitCode === 0;
    const failLine = [stderr, stdout].join("\n").split(/\r?\n/).find((l) => /AssertionError|FAIL|Error:|expected/i.test(l));
    return {
      ok,
      command: { command: "vitest run __atoms_review__/boundary.test.tsx", exitCode, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000), durationMs },
      summary: ok ? `Vitest 隔离边界单测通过 (${durationMs}ms)` : `Vitest 边界单测失败：${(failLine || "断言未通过").trim().slice(0, 220)}`,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runPlaywrightReview(files, plan, expectedSha256) {
  const started = Date.now();
  const artifactSha256 = computeFilesSha256(files);
  if (expectedSha256 && expectedSha256 !== artifactSha256) {
    return {
      backend: "cloudflare-sandbox",
      isolated: true,
      artifactSha256,
      ok: false,
      cases: (plan.cases || []).map((c) => ({
        criterion: c.criterion,
        strategy: c.strategy,
        status: "not_performed",
        summary: "目标产物 SHA-256 不一致，拒绝执行",
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

  const commands = [];
  const errors = [];
  const cases = [];
  const planCases = Array.isArray(plan?.cases) ? plan.cases : [];
  const needsPw = planCases.some((c) => (c.strategy === "playwright" || c.strategy === "hybrid") && Array.isArray(c.steps) && c.steps.length > 0);

  let htmlServer = null;
  let browser = null;
  let reviewUrl = "";

  try {
    if (needsPw) {
      const bStart = Date.now();
      const html = await bundleToStandaloneHtml(files);
      htmlServer = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
      });
      await new Promise((resolve, reject) => {
        htmlServer.once("error", reject);
        htmlServer.listen(0, "127.0.0.1", resolve);
      });
      const addr = htmlServer.address();
      reviewUrl = `http://127.0.0.1:${addr.port}/`;
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      commands.push({
        command: "playwright chromium --headless --viewport 960x640",
        exitCode: 0,
        stdout: `Bundled ${files.length} files & launched Chromium`,
        stderr: "",
        durationMs: Math.max(1, Date.now() - bStart),
      });
    }

    for (const c of planCases) {
      const cStart = Date.now();
      const wantPw = (c.strategy === "playwright" || c.strategy === "hybrid") && Array.isArray(c.steps) && c.steps.length > 0;
      const wantVt = (c.strategy === "vitest" || c.strategy === "hybrid") && Boolean(String(c.vitestCode || "").trim());

      let pwRes = null;
      let vtRes = null;

      if (wantPw && browser && reviewUrl) {
        const ctx = await browser.newContext({ viewport: { width: 960, height: 640 } });
        const consoleErrors = [];
        const pageErrors = [];
        const steps = [];
        try {
          const page = await ctx.newPage();
          page.on("console", (m) => { if (m.type() === "error" && consoleErrors.length < 20) consoleErrors.push(m.text().slice(0, 400)); });
          page.on("pageerror", (e) => { if (pageErrors.length < 20) pageErrors.push(String(e?.message || e).slice(0, 400)); });
          await page.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 10_000 });
          await page.waitForSelector('html[data-atoms-painted="1"]', { timeout: 4_000 }).catch(() => {});
          await page.waitForTimeout(120);

          const readState = () =>
            page.evaluate(() => {
              const r = document.getElementById("root");
              const text = (r?.innerText || r?.textContent || "").trim();
              const storage = {};
              try {
                for (let i = 0; i < window.localStorage.length; i += 1) {
                  const k = window.localStorage.key(i);
                  if (k) storage[k] = (window.localStorage.getItem(k) || "").slice(0, 500);
                }
              } catch {}
              const probeErrors = Array.isArray(window.__atomsProbeErrors) ? window.__atomsProbeErrors.slice(0, 20) : [];
              return { text, storage, probeErrors };
            });

          const init = await readState();
          const initialText = init.text.replace(/\s+/g, " ").trim().slice(0, 360);
          const storageBefore = init.storage;
          let lastText = initialText;
          let anyChanged = false;
          let allOk = true;

          for (let i = 0; i < c.steps.length; i += 1) {
            const act = c.steps[i];
            const sStart = Date.now();
            const label = act.type === "press"
              ? `按键 ${act.key}${act.count > 1 ? ` (x${act.count})` : ""}`
              : act.type === "click"
                ? `点击「${act.text || act.selector || act.role || "button"}」`
                : act.type === "fill"
                  ? `输入「${String(act.text || "").slice(0, 32)}」`
                  : act.type === "reload"
                    ? "刷新页面 (page.reload)"
                    : act.type === "wait"
                      ? `等待 ${act.ms}ms`
                      : "执行状态断言";
            const before = lastText;
            try {
              if (act.type === "press") {
                const count = Math.min(Math.max(1, Number(act.count || 1)), 12);
                for (let k = 0; k < count; k += 1) {
                  await page.keyboard.press(act.key);
                  await page.waitForTimeout(45);
                }
              } else if (act.type === "click") {
                const loc = act.selector
                  ? page.locator(act.selector).first()
                  : act.role && act.text
                    ? page.getByRole(act.role, { name: act.text }).first()
                    : act.text
                      ? page.getByRole("button", { name: act.text }).first()
                      : page.getByRole(act.role || "button").first();
                await loc.click({ timeout: ACTION_TIMEOUT_MS });
                await page.waitForTimeout(80);
              } else if (act.type === "fill") {
                const loc = act.selector
                  ? page.locator(act.selector).first()
                  : act.label
                    ? page.getByLabel(act.label).first()
                    : act.placeholder
                      ? page.getByPlaceholder(act.placeholder).first()
                      : page.locator('input:not([type="checkbox"]):not([type="radio"]), textarea').first();
                await loc.fill(String(act.text ?? ""), { timeout: ACTION_TIMEOUT_MS });
                await page.waitForTimeout(60);
              } else if (act.type === "wait") {
                await page.waitForTimeout(Math.min(Number(act.ms || 100), 2000));
              } else if (act.type === "reload") {
                await page.reload({ waitUntil: "domcontentloaded", timeout: 10_000 });
                await page.waitForSelector('html[data-atoms-painted="1"]', { timeout: 4_000 }).catch(() => {});
                await page.waitForTimeout(120);
              } else if (act.type === "assert") {
                const cur = await readState();
                const curCompact = cur.text.replace(/\s+/g, " ").trim().slice(0, 360);
                const errs = [...consoleErrors, ...pageErrors, ...cur.probeErrors];
                const fails = [];
                if (act.expectNoErrors && errs.length > 0) fails.push(`检测到报错：${errs.slice(0, 2).join("；")}`);
                if (act.expectText && !cur.text.toLowerCase().includes(String(act.expectText).toLowerCase())) {
                  fails.push(`未找到预期文案「${act.expectText}」`);
                }
                if (act.expectTextChanged && !anyChanged && curCompact === initialText) {
                  fails.push("交互前后页面内容未变化");
                }
                if (act.expectStorageChanged && Object.keys(cur.storage).length === 0) {
                  fails.push("localStorage 未写入任何状态");
                }
                if (fails.length > 0) throw new Error(fails.join("；"));
              }

              const after = (await readState()).text.replace(/\s+/g, " ").trim().slice(0, 360);
              const changed = after !== before;
              if (changed) anyChanged = true;
              lastText = after;
              steps.push({ stepIndex: i, action: label, ok: true, beforeSummary: before, afterSummary: after, changed, durationMs: Math.max(1, Date.now() - sStart) });
            } catch (err) {
              allOk = false;
              steps.push({ stepIndex: i, action: label, ok: false, beforeSummary: before, error: String(err?.message || err).slice(0, 400), durationMs: Math.max(1, Date.now() - sStart) });
              break;
            }
          }

          const finalState = await readState();
          for (const pe of finalState.probeErrors) {
            if (!pageErrors.includes(pe) && pageErrors.length < 20) pageErrors.push(pe);
          }
          let screenshotDataUrl;
          try {
            const buf = await page.screenshot({ type: "jpeg", quality: 58 });
            const url = `data:image/jpeg;base64,${buf.toString("base64")}`;
            if (url.length <= MAX_SCREENSHOT_DATA_URL_LEN) screenshotDataUrl = url;
          } catch {}

          const ok = allOk && consoleErrors.length === 0 && pageErrors.length === 0;
          const failStep = steps.find((s) => !s.ok);
          pwRes = {
            ok,
            steps,
            screenshotDataUrl,
            screenshotLabel: ok ? "交互验收通过快照" : "交互失败现场快照",
            consoleErrors,
            pageErrors,
            storageBefore,
            storageAfter: finalState.storage,
            summary: ok
              ? `Playwright 真浏览器执行 ${steps.length} 步均通过`
              : `Playwright 交互失败：${failStep?.error || pageErrors[0] || consoleErrors[0] || "未知错误"}`,
          };
        } finally {
          await ctx.close().catch(() => {});
        }
      }

      if (wantVt) {
        vtRes = await runIsolatedVitest(files, c.vitestCode);
        commands.push(vtRes.command);
      }

      if (!pwRes && !vtRes) {
        cases.push({
          criterion: c.criterion,
          strategy: c.strategy,
          status: "not_performed",
          summary: "未提供可执行的交互步骤或边界测试",
          steps: [],
          consoleErrors: [],
          pageErrors: [],
          durationMs: Math.max(1, Date.now() - cStart),
        });
        continue;
      }

      const ok = (pwRes ? pwRes.ok : true) && (vtRes ? vtRes.ok : true);
      cases.push({
        criterion: c.criterion,
        strategy: c.strategy,
        status: ok ? "passed" : "failed",
        summary: [pwRes?.summary, vtRes?.summary].filter(Boolean).join("；").slice(0, 600),
        steps: pwRes?.steps || [],
        ...(pwRes?.screenshotDataUrl ? { screenshotDataUrl: pwRes.screenshotDataUrl, screenshotLabel: pwRes.screenshotLabel } : {}),
        ...(vtRes ? { vitestCommand: vtRes.command } : {}),
        consoleErrors: pwRes?.consoleErrors || [],
        pageErrors: pwRes?.pageErrors || [],
        ...(pwRes ? { storageBefore: pwRes.storageBefore, storageAfter: pwRes.storageAfter } : {}),
        durationMs: Math.max(1, Date.now() - cStart),
      });
    }

    return {
      backend: "cloudflare-sandbox",
      isolated: true,
      artifactSha256,
      ok: errors.length === 0 && cases.every((c) => c.status !== "failed"),
      cases,
      commands,
      errors,
      durationMs: Math.max(1, Date.now() - started),
    };
  } finally {
    await browser?.close().catch(() => {});
    if (htmlServer) await new Promise((r) => htmlServer.close(() => r()));
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, capabilities: ["tsc", "vitest", "playwright"] });
  }

  if (BRIDGE_TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${BRIDGE_TOKEN}`) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
  }

  if (req.method === "POST" && req.url === "/verify") {
    try {
      const body = await readJsonBody(req);
      if (!Array.isArray(body?.files)) return sendJson(res, 400, { error: "files array required" });
      const report = await runTscVerify(body.files);
      return sendJson(res, 200, report);
    } catch (err) {
      return sendJson(res, 500, { error: String(err?.message || err) });
    }
  }

  if (req.method === "POST" && req.url === "/review") {
    try {
      const body = await readJsonBody(req);
      if (!Array.isArray(body?.files) || !body?.plan) {
        return sendJson(res, 400, { error: "files and plan required" });
      }
      const report = await runPlaywrightReview(body.files, body.plan, body.artifactSha256);
      return sendJson(res, 200, report);
    } catch (err) {
      return sendJson(res, 500, { error: String(err?.message || err) });
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[atoms-sandbox-server] listening on :${PORT} (tsc + vitest + playwright)`);
});
