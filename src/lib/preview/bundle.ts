import type {
  Loader,
  Plugin,
} from "esbuild-wasm";
import {
  PREVIEW_TAILWIND_PATH,
  PREVIEW_VENDOR_MAP,
  PREVIEW_VENDOR_MODULE_ID,
  PREVIEW_VENDOR_RUNTIME_PATH,
  PREVIEW_WASM_PATH,
  containsBlockedCdnUrl,
  isPreviewVendorSpecifier,
  type PreviewVendorSpecifier,
} from "./vendor";

export type PreviewFile = {
  path: string;
  content: string;
};

export type BundleResult =
  | { ok: true; js: string; css: string; vendorJs: string }
  | { ok: false; messageZh: string };

type EsbuildApi = typeof import("esbuild-wasm");

let esbuildApi: EsbuildApi | null = null;
let initPromise: Promise<void> | null = null;
let vendorIifeCache: string | null = null;
let cssCache: string | null = null;

async function loadEsbuildApi(): Promise<EsbuildApi> {
  if (esbuildApi) return esbuildApi;
  // Browser/client: explicit browser entry so Turbopack never follows Node
  // `main` (child_process spawn of bin/esbuild). Node tests: default entry.
  if (typeof window !== "undefined") {
    esbuildApi = (await import("esbuild-wasm/lib/browser.js")) as EsbuildApi;
  } else {
    // Keep the Node-only test entry out of Next's server bundle: esbuild's
    // package entry references a native subprocess unavailable in workers.
    const nodeModule = process.getBuiltinModule("module") as
      | typeof import("node:module")
      | undefined;
    if (!nodeModule) throw new Error("Node module loader unavailable");
    const requireFromProject = nodeModule.createRequire(
      `${process.cwd()}/package.json`,
    );
    esbuildApi = requireFromProject("esbuild-wasm") as EsbuildApi;
  }
  return esbuildApi;
}

/** Tiny ESM shim over the global vendor IIFE (single React instance). */
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

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}

function dirname(path: string): string {
  const parts = normalizePath(path).split("/");
  parts.pop();
  return parts.join("/");
}

function resolveRelative(from: string, request: string): string {
  if (!request.startsWith(".")) return request;
  const base = dirname(from).split("/").filter(Boolean);
  for (const part of request.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

function findFile(
  files: Map<string, string>,
  requestPath: string,
): string | null {
  const candidates = [
    requestPath,
    `${requestPath}.tsx`,
    `${requestPath}.ts`,
    `${requestPath}.jsx`,
    `${requestPath}.js`,
    `${requestPath}/index.tsx`,
    `${requestPath}/index.ts`,
    `${requestPath}/index.jsx`,
    `${requestPath}/index.js`,
  ];
  for (const candidate of candidates) {
    const key = normalizePath(candidate);
    if (files.has(key)) return key;
  }
  return null;
}

function pickEntry(files: Map<string, string>): string | null {
  const preferred = [
    "src/main.tsx",
    "src/main.ts",
    "src/main.jsx",
    "src/main.js",
    "src/index.tsx",
    "src/index.ts",
    "main.tsx",
    "index.tsx",
  ];
  for (const path of preferred) {
    if (files.has(path)) return path;
  }
  for (const path of files.keys()) {
    if (/\.(tsx|ts|jsx|js)$/.test(path)) return path;
  }
  return null;
}

export async function ensureEsbuildInitialized(
  wasmURL: string = PREVIEW_WASM_PATH,
): Promise<EsbuildApi> {
  if (!initPromise) {
    initPromise = (async () => {
      const api = await loadEsbuildApi();
      if (typeof window === "undefined") {
        // Node's default entry auto-starts a service and rejects wasmURL.
        await api.initialize({});
      } else {
        await api.initialize({ wasmURL, worker: false });
      }
    })();
  }
  await initPromise;
  return loadEsbuildApi();
}

async function fetchText(url: string): Promise<string> {
  if (typeof window === "undefined" && url.startsWith("/")) {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return readFile(join(process.cwd(), "public", url.replace(/^\//, "")), "utf8");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载预览资源：${url} (${response.status})`);
  }
  return response.text();
}

export async function loadVendorIife(
  fetchImpl: (url: string) => Promise<string> = fetchText,
): Promise<string> {
  if (vendorIifeCache) return vendorIifeCache;
  vendorIifeCache = await fetchImpl(PREVIEW_VENDOR_RUNTIME_PATH);
  return vendorIifeCache;
}

/** @deprecated Prefer loadVendorIife — kept for older call sites/tests. */
export async function loadVendorSources(
  fetchImpl: (url: string) => Promise<string> = fetchText,
): Promise<Map<string, string>> {
  const source = await loadVendorIife(fetchImpl);
  const map = new Map<string, string>();
  map.set(PREVIEW_VENDOR_MODULE_ID, source);
  for (const specifier of Object.keys(PREVIEW_VENDOR_MAP) as PreviewVendorSpecifier[]) {
    map.set(specifier, source);
  }
  return map;
}

export async function loadPreviewCss(
  fetchImpl: (url: string) => Promise<string> = fetchText,
): Promise<string> {
  if (cssCache) return cssCache;
  cssCache = await fetchImpl(PREVIEW_TAILWIND_PATH);
  return cssCache;
}

/** Test-only: reset caches between cases. */
export function resetPreviewAssetCaches(): void {
  vendorIifeCache = null;
  cssCache = null;
}

function createVirtualPlugin(files: Map<string, string>): Plugin {
  return {
    name: "atoms-virtual-fs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          return { path: normalizePath(args.path), namespace: "virtual" };
        }

        if (isPreviewVendorSpecifier(args.path)) {
          // Shim only — real React lives in the preloaded vendor IIFE.
          return { path: args.path, namespace: "vendor-shim" };
        }

        if (args.path.startsWith(".") || args.path.startsWith("/")) {
          const resolved = resolveRelative(args.importer, args.path);
          const found = findFile(files, resolved);
          if (!found) {
            return {
              errors: [
                {
                  text: `找不到模块：${args.path}（从 ${args.importer}）`,
                },
              ],
            };
          }
          return { path: found, namespace: "virtual" };
        }

        return {
          errors: [
            {
              text: `未加入白名单的依赖：${args.path}（禁止 CDN，请使用自托管 vendor）`,
            },
          ],
        };
      });

      build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
        const contents = files.get(normalizePath(args.path));
        if (contents == null) {
          return { errors: [{ text: `虚拟文件系统中缺少：${args.path}` }] };
        }
        const loader: Loader = args.path.endsWith(".tsx")
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

      build.onLoad({ filter: /.*/, namespace: "vendor-shim" }, () => ({
        contents: VENDOR_SHIM,
        loader: "js",
      }));
    },
  };
}

export async function bundlePreviewFiles(
  inputFiles: PreviewFile[],
  options?: {
    wasmURL?: string;
    fetchAsset?: (url: string) => Promise<string>;
  },
): Promise<BundleResult> {
  for (const file of inputFiles) {
    if (containsBlockedCdnUrl(file.content)) {
      return {
        ok: false,
        messageZh: "生成代码引用了外部 CDN，已阻止预览（国内可达红线）。",
      };
    }
  }

  const files = new Map<
    string,
    string
  >(inputFiles.map((f) => [normalizePath(f.path), f.content]));

  const entry = pickEntry(files);
  if (!entry) {
    return { ok: false, messageZh: "没有可打包的入口文件（如 src/main.tsx）。" };
  }

  try {
    const fetchAsset = options?.fetchAsset ?? fetchText;
    const [vendorJs, css] = await Promise.all([
      loadVendorIife(fetchAsset),
      loadPreviewCss(fetchAsset),
    ]);

    const api = await ensureEsbuildInitialized(
      options?.wasmURL ?? PREVIEW_WASM_PATH,
    );
    const result = await api.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      // IIFE + classic script: opaque sandboxed iframes block module scripts.
      format: "iife",
      platform: "browser",
      jsx: "automatic",
      target: ["es2020"],
      plugins: [createVirtualPlugin(files)],
      logLevel: "silent",
    });

    const js = result.outputFiles?.[0]?.text;
    if (!js) {
      return { ok: false, messageZh: "打包结果为空，请检查生成的源码。" };
    }
    if (containsBlockedCdnUrl(js) || containsBlockedCdnUrl(vendorJs)) {
      return {
        ok: false,
        messageZh: "打包产物包含外部 CDN 引用，已阻止预览。",
      };
    }

    return { ok: true, js, css, vendorJs };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "未知打包错误";
    return {
      ok: false,
      messageZh: `预览打包失败：${detail}`,
    };
  }
}

/**
 * Fully inlined srcdoc so a sandboxed iframe (opaque origin; no same-origin
 * grant) never needs to fetch host or remote assets. Classic scripts only —
 * module scripts do not execute under an opaque iframe origin.
 *
 * Order: vendor IIFE (installs global) → app IIFE (shim imports) → paint beacon.
 */
export function buildPreviewSrcdoc(
  js: string,
  css: string,
  vendorJs = "",
): string {
  const escapedVendor = vendorJs.replace(/<\/script/gi, "<\\/script");
  const escapedJs = js.replace(/<\/script/gi, "<\\/script");
  const escapedCss = css.replace(/<\/style/gi, "<\\/style");

  // Wait for React to commit visible text into #root, then report that text
  // to the host (the opaque iframe prevents the host from reading its DOM).
  const paintBeacon = `try{(function(){var r=document.getElementById("root");if(!r)return;function done(){var text=(r.innerText||r.textContent||"").trim();if(!text)return false;document.documentElement.setAttribute("data-atoms-painted","1");if(window.parent&&window.parent!==window){window.parent.postMessage({source:"atoms-preview",type:"painted",text:text},"*");}return true;}if(done())return;var n=0;var id=setInterval(function(){n++;if(done()){clearInterval(id);}else if(n>100){clearInterval(id);}},50);})();}catch(e){}`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atoms Preview</title>
  <style>${escapedCss}</style>
</head>
<body class="atoms-preview-root">
  <div id="root"></div>
  <script>${escapedVendor}</script>
  <script>${escapedJs}</script>
  <script>${paintBeacon}</script>
</body>
</html>`;
}
