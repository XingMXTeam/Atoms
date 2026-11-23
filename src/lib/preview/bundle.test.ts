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

describe("preview bundle (REQ-5 / REQ-6)", () => {
  it("bundles the mock React fixture without CDN URLs", async () => {
    const result = await bundlePreviewFiles(MOCK_ENGINEER_FILES, { wasmURL });
    if (!result.ok) {
      expect.fail(`bundle failed: ${result.messageZh}`);
    }
    expect(result.ok).toBe(true);

    const hasMarker =
      result.js.includes("我的待办") ||
      result.js.includes("\\u6211\\u7684\\u5f85\\u529e") ||
      result.js.includes("mock-app");
    if (!hasMarker) {
      expect.fail(
        `marker missing; js length=${result.js.length}; head=${result.js.slice(0, 120)}`,
      );
    }
    expect(hasMarker).toBe(true);
    expect(containsBlockedCdnUrl(result.js)).toBe(false);
    expect(result.css.length).toBeGreaterThan(0);

    const srcdoc = buildPreviewSrcdoc(result.js, result.css);
    expect(srcdoc).toContain("<style>");
    expect(srcdoc).toContain('type="module"');
    const srcdocHasMarker =
      srcdoc.includes("我的待办") ||
      srcdoc.includes("\\u6211\\u7684\\u5f85\\u529e") ||
      srcdoc.includes("mock-app");
    expect(srcdocHasMarker).toBe(true);
    expect(containsBlockedCdnUrl(srcdoc)).toBe(false);
    expect(srcdoc.includes("esm.sh")).toBe(false);
    expect(srcdoc.includes("unpkg")).toBe(false);
    expect(srcdoc.includes("jsdelivr")).toBe(false);
  }, 60_000);

  it("rejects source that references blocked CDNs", async () => {
    const result = await bundlePreviewFiles(
      [
        {
          path: "src/main.tsx",
          content:
            'import "https://esm.sh/react";\nexport default function App(){return null}',
        },
      ],
      { wasmURL },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.messageZh).toMatch(/CDN/);
  });
});
