import { describe, expect, it } from "vitest";
import {
  CDN_HOST_BLOCKLIST,
  PREVIEW_VENDOR_MAP,
  PREVIEW_VENDOR_RUNTIME_PATH,
  containsBlockedCdnUrl,
  listVendorPaths,
  vendorUrl,
} from "./vendor";

describe("preview vendor map (REQ-6 / RL-2)", () => {
  it("maps every React specifier to the combined same-origin runtime", () => {
    expect(PREVIEW_VENDOR_MAP.react).toBe(PREVIEW_VENDOR_RUNTIME_PATH);
    expect(PREVIEW_VENDOR_MAP["react/jsx-runtime"]).toBe(
      PREVIEW_VENDOR_RUNTIME_PATH,
    );
    expect(PREVIEW_VENDOR_MAP["react-dom/client"]).toBe(
      PREVIEW_VENDOR_RUNTIME_PATH,
    );
    expect(vendorUrl("react", "https://atoms.example")).toBe(
      `https://atoms.example${PREVIEW_VENDOR_RUNTIME_PATH}`,
    );
  });

  it("lists only same-origin asset paths and blocks CDN hosts", () => {
    const paths = listVendorPaths();
    expect(paths).toContain("/preview/esbuild.wasm");
    expect(paths).toContain("/preview/tailwind.css");
    expect(paths).toContain(PREVIEW_VENDOR_RUNTIME_PATH);
    for (const path of paths) {
      expect(path.startsWith("/preview/")).toBe(true);
      expect(containsBlockedCdnUrl(path)).toBe(false);
    }
    for (const host of CDN_HOST_BLOCKLIST) {
      expect(containsBlockedCdnUrl(`https://${host}/react`)).toBe(true);
    }
  });
});
