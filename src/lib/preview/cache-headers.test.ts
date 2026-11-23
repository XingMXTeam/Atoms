import { describe, expect, it } from "vitest";
import {
  PREVIEW_CACHE_CONTROL,
  isLongLivedPreviewCacheControl,
  previewAssetHeaderRules,
} from "./cache-headers";

describe("preview cache headers (REQ-4)", () => {
  it("exposes a long-lived immutable Cache-Control value", () => {
    expect(isLongLivedPreviewCacheControl(PREVIEW_CACHE_CONTROL)).toBe(true);
    expect(PREVIEW_CACHE_CONTROL.toLowerCase()).toContain("public");
    expect(PREVIEW_CACHE_CONTROL.toLowerCase()).toContain("immutable");
    expect(PREVIEW_CACHE_CONTROL.toLowerCase()).toMatch(/max-age=\d+/);
  });

  it("maps /preview/:path* to Cache-Control for Next headers()", () => {
    const rules = previewAssetHeaderRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/preview/:path*");
    const cache = rules[0]?.headers.find((h) => h.key === "Cache-Control");
    expect(cache?.value).toBe(PREVIEW_CACHE_CONTROL);
    expect(isLongLivedPreviewCacheControl(cache?.value)).toBe(true);
  });

  it("rejects short or missing cache policies", () => {
    expect(isLongLivedPreviewCacheControl(null)).toBe(false);
    expect(isLongLivedPreviewCacheControl("no-store")).toBe(false);
    expect(isLongLivedPreviewCacheControl("public, max-age=60")).toBe(false);
  });
});
