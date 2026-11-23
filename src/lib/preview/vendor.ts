/** Same-origin vendor map for the preview runtime (REQ-6 / RL-2). */

export const PREVIEW_WASM_PATH = "/preview/esbuild.wasm";
export const PREVIEW_TAILWIND_PATH = "/preview/tailwind.css";

/** Specifier → same-origin URL (never CDN). */
export const PREVIEW_VENDOR_MAP = {
  react: "/preview/vendor/react.js",
  "react/jsx-runtime": "/preview/vendor/jsx-runtime.js",
  "react/jsx-dev-runtime": "/preview/vendor/jsx-runtime.js",
  "react-dom/client": "/preview/vendor/react-dom-client.js",
} as const;

export type PreviewVendorSpecifier = keyof typeof PREVIEW_VENDOR_MAP;

export const CDN_HOST_BLOCKLIST = [
  "esm.sh",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "jsdelivr.net",
  "cdn.tailwindcss.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
] as const;

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
    ...Object.values(PREVIEW_VENDOR_MAP),
  ];
}
