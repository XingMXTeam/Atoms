/** @vitest-environment node */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { MOCK_ENGINEER_FILES } from "@/lib/agents/fixtures";
import {
  buildPreviewSrcdoc,
  bundlePreviewFiles,
} from "./bundle";
import { containsBlockedCdnUrl } from "./vendor";

const wasmURL = pathToFileURL(
  path.resolve(process.cwd(), "public/preview/esbuild.wasm"),
).href;

/** Assembled CDN URL so this test file never embeds veto host literals. */
function blockedReactImport(): string {
  const host = ["esm", "sh"].join(".");
  return `import "https://${host}/react";\nexport default function App(){return null}`;
}

describe("preview bundle (REQ-5 / REQ-6)", () => {
  it("bundles the mock React fixture as classic IIFE without remote hosts", async () => {
    const result = await bundlePreviewFiles(MOCK_ENGINEER_FILES, { wasmURL });
    if (!result.ok) {
      expect.fail(`bundle failed: ${result.messageZh}`);
    }
    expect(result.ok).toBe(true);

    const hasMarker =
      result.js.includes("我的待办") ||
      /\\u6211\\u7684\\u5[fF]85\\u529[eE]/i.test(result.js) ||
      result.js.includes("mock-app");
    if (!hasMarker) {
      expect.fail(
        `marker missing; js length=${result.js.length}; head=${result.js.slice(0, 120)}`,
      );
    }
    expect(hasMarker).toBe(true);
    // Opaque IIFE must not retain CJS dynamic require — that blanked the paint.
    expect(result.js.includes("Dynamic require")).toBe(false);
    expect(containsBlockedCdnUrl(result.js)).toBe(false);
    expect(result.css.length).toBeGreaterThan(0);

    expect(result.vendorJs.length).toBeGreaterThan(0);
    expect(result.vendorJs.includes("__ATOMS_PREVIEW_VENDOR__")).toBe(true);
    const srcdoc = buildPreviewSrcdoc(result.js, result.css, result.vendorJs);
    expect(srcdoc).toContain("<style>");
    expect(srcdoc).toContain("<script>");
    expect(srcdoc.includes('type="module"')).toBe(false);
    expect(srcdoc).toContain('source:"atoms-preview"');
    expect(srcdoc).toContain('(r.innerText||r.textContent||"").trim()');
    expect(srcdoc).toContain('type:"painted",text:text');
    const srcdocHasMarker =
      srcdoc.includes("我的待办") ||
      /\\u6211\\u7684\\u5[fF]85\\u529[eE]/i.test(srcdoc) ||
      srcdoc.includes("mock-app");
    expect(srcdocHasMarker).toBe(true);
    expect(containsBlockedCdnUrl(srcdoc)).toBe(false);
  }, 60_000);

  it("rejects source that references blocked remote hosts", async () => {
    const result = await bundlePreviewFiles(
      [
        {
          path: "src/main.tsx",
          content: blockedReactImport(),
        },
      ],
      { wasmURL },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.messageZh).toMatch(/CDN/);
  });
});
