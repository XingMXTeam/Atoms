/** Long-term Cache-Control for self-hosted `/preview/*` assets (REQ-4). */

export const PREVIEW_CACHE_CONTROL =
  "public, max-age=31536000, immutable" as const;

export type PreviewHeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

/** Next.js `headers()` rules for preview runtime assets. */
export function previewAssetHeaderRules(): PreviewHeaderRule[] {
  return [
    {
      source: "/preview/:path*",
      headers: [{ key: "Cache-Control", value: PREVIEW_CACHE_CONTROL }],
    },
  ];
}

/** Hashed Next build assets. Filenames change when contents change. */
export const STATIC_ASSET_CACHE_CONTROL = PREVIEW_CACHE_CONTROL;

export function hashedStaticHeaderRules(): PreviewHeaderRule[] {
  return [
    {
      source: "/_next/static/:path*",
      headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
    },
  ];
}

export function isLongLivedPreviewCacheControl(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  const hasPublic = lower.includes("public");
  const hasImmutable = lower.includes("immutable");
  const maxAge = /max-age=(\d+)/.exec(lower);
  const seconds = maxAge ? Number(maxAge[1]) : 0;
  return hasPublic && hasImmutable && seconds >= 86_400;
}
