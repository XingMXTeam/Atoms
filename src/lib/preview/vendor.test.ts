import { describe, expect, it } from "vitest";
import {
  CDN_HOST_BLOCKLIST,
  PREVIEW_VENDOR_MAP,
  containsBlockedCdnUrl,
  listVendorPaths,
  vendorUrl,
} from "./vendor";

describe("preview vendor map (REQ-6 / RL-2)", () => {
  it("maps React entrypoints to same-origin /preview paths", () => {
    expect(PREVIEW_VENDOR_MAP.react).toBe("/preview/vendor/react.js");
    expect(PREVIEW_VENDOR_MAP["react-dom/client"]).toBe(
      "/preview/vendor/react-dom-client.js",
    );
    expect(vendorUrl("react", "https://atoms.example")).toBe(
      "https://atoms.example/preview/vendor/react.js",
    );
  });

  it("lists only same-origin asset paths and blocks CDN hosts", () => {
    const paths = listVendorPaths();
    expect(paths).toContain("/preview/esbuild.wasm");
    expect(paths).toContain("/preview/tailwind.css");
    for (const path of paths) {
      expect(path.startsWith("/preview/")).toBe(true);
      expect(containsBlockedCdnUrl(path)).toBe(false);
    }
    for (const host of CDN_HOST_BLOCKLIST) {
      expect(containsBlockedCdnUrl(`https://${host}/react`)).toBe(true);
    }
  });
});
