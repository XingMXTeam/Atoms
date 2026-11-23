import * as esbuild from "esbuild-wasm";
import {
  PREVIEW_TAILWIND_PATH,
  PREVIEW_VENDOR_MAP,
  PREVIEW_WASM_PATH,
  containsBlockedCdnUrl,
  type PreviewVendorSpecifier,
} from "./vendor";

export type PreviewFile = {
  path: string;
  content: string;
};

export type BundleResult =
  | { ok: true; js: string; css: string }
  | { ok: false; messageZh: string };

let initPromise: Promise<void> | null = null;
let vendorCache: Map<string, string> | null = null;
let cssCache: string | null = null;

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
): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      // Node's esbuild-wasm entry auto-starts a service and rejects wasmURL.
      // Browser entry requires wasmURL pointing at our self-hosted asset.
      if (typeof window === "undefined") {
        await esbuild.initialize({});
        return;
      }
      await esbuild.initialize({ wasmURL, worker: false });
    })();
  }
  await initPromise;
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

export async function loadVendorSources(
  fetchImpl: (url: string) => Promise<string> = fetchText,
): Promise<Map<string, string>> {
  if (vendorCache) return vendorCache;
  const map = new Map<string, string>();
  for (const [specifier, url] of Object.entries(PREVIEW_VENDOR_MAP) as [
    PreviewVendorSpecifier,
    string,
  ][]) {
    map.set(specifier, await fetchImpl(url));
  }
  // react-dom/client bundle still imports "react" as external — already covered.
  vendorCache = map;
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
  vendorCache = null;
  cssCache = null;
}

function createVirtualPlugin(
  files: Map<string, string>,
  vendors: Map<string, string>,
): esbuild.Plugin {
  return {
    name: "atoms-virtual-fs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          return { path: normalizePath(args.path), namespace: "virtual" };
        }

        if (vendors.has(args.path)) {
          return { path: args.path, namespace: "vendor" };
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
        const loader: esbuild.Loader = args.path.endsWith(".tsx")
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

      build.onLoad({ filter: /.*/, namespace: "vendor" }, (args) => {
        const contents = vendors.get(args.path);
        if (contents == null) {
          return { errors: [{ text: `缺少自托管依赖：${args.path}` }] };
        }
        return { contents, loader: "js", resolveDir: "/" };
      });
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
    const [vendors, css] = await Promise.all([
      loadVendorSources(fetchAsset),
      loadPreviewCss(fetchAsset),
    ]);

    await ensureEsbuildInitialized(options?.wasmURL ?? PREVIEW_WASM_PATH);
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      target: ["es2020"],
      plugins: [createVirtualPlugin(files, vendors)],
      logLevel: "silent",
    });

    const js = result.outputFiles?.[0]?.text;
    if (!js) {
      return { ok: false, messageZh: "打包结果为空，请检查生成的源码。" };
    }
    if (containsBlockedCdnUrl(js)) {
      return {
        ok: false,
        messageZh: "打包产物包含外部 CDN 引用，已阻止预览。",
      };
    }

    return { ok: true, js, css };
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
 * Fully inlined srcdoc so a sandboxed iframe (opaque origin, no
 * allow-same-origin) never needs to fetch host or CDN assets.
 */
export function buildPreviewSrcdoc(js: string, css: string): string {
  const escapedJs = js.replace(/<\/script/gi, "<\\/script");
  const escapedCss = css.replace(/<\/style/gi, "<\\/style");

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
  <script type="module">${escapedJs}</script>
</body>
</html>`;
}
