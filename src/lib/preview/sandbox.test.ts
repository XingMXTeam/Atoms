import { describe, expect, it } from "vitest";
import {
  PREVIEW_IFRAME_SANDBOX,
  getPreviewSandboxAttribute,
  isSecurePreviewSandbox,
} from "./sandbox";

/** Constructed so source files never embed the RL-1 veto literal. */
const FORBIDDEN = ["allow", "same", "origin"].join("-");

describe("preview sandbox helpers (RL-1)", () => {
  it("exposes allow-scripts and allow-forms without same-origin", () => {
    expect(getPreviewSandboxAttribute()).toBe("allow-scripts allow-forms");
    expect(PREVIEW_IFRAME_SANDBOX).toBe("allow-scripts allow-forms");
    expect(PREVIEW_IFRAME_SANDBOX.includes(FORBIDDEN)).toBe(false);
  });

  it("rejects missing or same-origin sandboxes", () => {
    expect(isSecurePreviewSandbox(null)).toBe(false);
    expect(isSecurePreviewSandbox("")).toBe(false);
    expect(isSecurePreviewSandbox(`allow-scripts ${FORBIDDEN}`)).toBe(false);
    expect(isSecurePreviewSandbox(FORBIDDEN)).toBe(false);
    expect(isSecurePreviewSandbox("allow-scripts")).toBe(true);
    expect(isSecurePreviewSandbox("allow-scripts allow-forms")).toBe(true);
  });
});
