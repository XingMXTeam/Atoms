import { describe, expect, it } from "vitest";
import {
  PREVIEW_MOBILE_WIDTH_PX,
  isPreviewWidthMode,
  previewFrameMaxWidthPx,
} from "./width";

describe("preview width helpers (REQ-5)", () => {
  it("constrains mobile mode to 375px and leaves desktop unconstrained", () => {
    expect(PREVIEW_MOBILE_WIDTH_PX).toBe(375);
    expect(previewFrameMaxWidthPx("mobile")).toBe(375);
    expect(previewFrameMaxWidthPx("desktop")).toBeNull();
  });

  it("narrows unknown values", () => {
    expect(isPreviewWidthMode("desktop")).toBe(true);
    expect(isPreviewWidthMode("mobile")).toBe(true);
    expect(isPreviewWidthMode("tablet")).toBe(false);
    expect(isPreviewWidthMode(null)).toBe(false);
  });
});
