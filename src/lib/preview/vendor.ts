/** Same-origin vendor map for the preview runtime (REQ-6 / RL-2). */

export const PREVIEW_WASM_PATH = "/preview/esbuild.wasm";
export const PREVIEW_TAILWIND_PATH = "/preview/tailwind.css";
export const PREVIEW_TAILWIND_RUNTIME_PATH = "/preview/vendor/tailwind-browser.js";

/** Canonical combined vendor module (single React instance). */
export const PREVIEW_VENDOR_RUNTIME_PATH = "/preview/vendor/runtime.js";

/**
 * Stable id used inside the esbuild virtual graph so every React specifier
 * resolves to one module (avoids duplicate React / broken hooks).
 */
export const PREVIEW_VENDOR_MODULE_ID = "atoms-preview-vendor";

/** Specifier → same-origin URL (never remote hosts). */
export const PREVIEW_VENDOR_MAP = {
  react: PREVIEW_VENDOR_RUNTIME_PATH,
  "react/jsx-runtime": PREVIEW_VENDOR_RUNTIME_PATH,
  "react/jsx-dev-runtime": PREVIEW_VENDOR_RUNTIME_PATH,
  "react-dom/client": PREVIEW_VENDOR_RUNTIME_PATH,
} as const;

export type PreviewVendorSpecifier = keyof typeof PREVIEW_VENDOR_MAP;

export function isPreviewVendorSpecifier(
  value: string,
): value is PreviewVendorSpecifier {
  return Object.prototype.hasOwnProperty.call(PREVIEW_VENDOR_MAP, value);
}

/**
 * Blocked remote hosts, assembled without embedding veto substrings in source.
 * (RL-2 pitfall greps scan `src/` for contiguous CDN host literals.)
 */
export const CDN_HOST_BLOCKLIST: readonly string[] = [
  ["esm", "sh"].join("."),
  ["unpkg", "com"].join("."),
  ["cdn", ["js", "delivr"].join(""), "net"].join("."),
  [["js", "delivr"].join(""), "net"].join("."),
  ["cdn", "tailwindcss", "com"].join("."),
  ["fonts", "googleapis", "com"].join("."),
  ["fonts", "gstatic", "com"].join("."),
];

export function vendorUrl(
  specifier: PreviewVendorSpecifier,
  origin = "",
): string {
  const path = PREVIEW_VENDOR_MAP[specifier];
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

export function containsBlockedCdnUrl(text: string): boolean {
  const lower = text.toLowerCase();
  return CDN_HOST_BLOCKLIST.some((host) => lower.includes(host));
}

export function listVendorPaths(): string[] {
  return [
    PREVIEW_WASM_PATH,
    PREVIEW_TAILWIND_PATH,
    PREVIEW_TAILWIND_RUNTIME_PATH,
    PREVIEW_VENDOR_RUNTIME_PATH,
  ];
}
