/** Desktop / mobile preview frame widths for the 预览 tab (REQ-5). */

export type PreviewWidthMode = "desktop" | "mobile";

export const PREVIEW_MOBILE_WIDTH_PX = 375 as const;

export function previewFrameMaxWidthPx(
  mode: PreviewWidthMode,
): number | null {
  return mode === "mobile" ? PREVIEW_MOBILE_WIDTH_PX : null;
}

export function isPreviewWidthMode(value: unknown): value is PreviewWidthMode {
  return value === "desktop" || value === "mobile";
}
