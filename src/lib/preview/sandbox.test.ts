import { describe, expect, it } from "vitest";
import {
  PREVIEW_IFRAME_SANDBOX,
  getPreviewSandboxAttribute,
  isSecurePreviewSandbox,
} from "./sandbox";

describe("preview sandbox helpers (RL-1)", () => {
  it("exposes allow-scripts only", () => {
    expect(getPreviewSandboxAttribute()).toBe("allow-scripts");
    expect(PREVIEW_IFRAME_SANDBOX).toBe("allow-scripts");
    expect(PREVIEW_IFRAME_SANDBOX.includes("allow-same-origin")).toBe(false);
  });

  it("rejects missing or allow-same-origin sandboxes", () => {
    expect(isSecurePreviewSandbox(null)).toBe(false);
    expect(isSecurePreviewSandbox("")).toBe(false);
    expect(isSecurePreviewSandbox("allow-scripts allow-same-origin")).toBe(
      false,
    );
    expect(isSecurePreviewSandbox("allow-same-origin")).toBe(false);
    expect(isSecurePreviewSandbox("allow-scripts")).toBe(true);
  });
});
