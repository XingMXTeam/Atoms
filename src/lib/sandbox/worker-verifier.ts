import { containsBlockedCdnUrl, isPreviewVendorSpecifier } from "@/lib/preview/vendor";
import type { SandboxFile, SandboxVerifyReport } from "./types";

const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function normalizePath(p: string): string {
  return p.replace(/^\/+/, "").replace(/^\.\//, "");
}

/**
 * Lightweight, zero-subprocess verification executed inside Cloudflare Workers
 * when Cloudflare Containers (`env.Sandbox`) is not bound.
 */
export function runWorkerStaticVerifier(files: SandboxFile[]): SandboxVerifyReport {
  const started = Date.now();
  const errors: string[] = [];
  const normalizedPaths = new Set(files.map((f) => normalizePath(f.path)));

  const hasEntry =
    normalizedPaths.has("src/main.tsx") ||
    normalizedPaths.has("src/main.ts") ||
    normalizedPaths.has("src/App.tsx");
  if (!hasEntry) {
    errors.push("缺少入口文件 src/main.tsx 或 src/App.tsx");
  }

  for (const file of files) {
    const clean = normalizePath(file.path);
    if (clean.includes("..")) {
      errors.push(`非法文件路径：${file.path}`);
      continue;
    }
    if (containsBlockedCdnUrl(file.content)) {
      errors.push(`${clean}: 检测到被禁止的外部 CDN 引用`);
    }
    if (/\bdocument\.cookie\b/.test(file.content)) {
      errors.push(`${clean}: 禁止访问 document.cookie`);
    }

    IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_RE.exec(file.content)) !== null) {
      const spec = match[1] ?? "";
      if (spec.startsWith(".") || spec.startsWith("/")) continue;
      if (!isPreviewVendorSpecifier(spec)) {
        errors.push(`${clean}: 不支持的第三方依赖 "${spec}"`);
      }
    }
  }

  const durationMs = Math.max(1, Date.now() - started);
  const ok = errors.length === 0;
  return {
    backend: "worker-static-verifier",
    isolated: false,
    ok,
    commands: [
      {
        command: "worker-verify --entry --imports --cdn-policy",
        exitCode: ok ? 0 : 1,
        stdout: ok ? `verified ${files.length} files (entry, imports, sandbox policy OK)` : "",
        stderr: errors.join("\n"),
        durationMs,
      },
    ],
    errors,
    durationMs,
  };
}
