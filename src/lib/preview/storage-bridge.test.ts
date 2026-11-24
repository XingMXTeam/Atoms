/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildPreviewStorageShim,
  isPreviewStorageMessage,
  MAX_PREVIEW_STORAGE_KEYS,
  PREVIEW_STORAGE_LIMIT_BYTES,
  sanitizePreviewState,
} from "./storage-bridge";

describe("preview storage bridge", () => {
  it("sanitizes non-string values and enforces key and byte caps", () => {
    const oversized: Record<string, unknown> = {
      ok: "hello",
      badNum: 42,
      "": "empty-key",
    };
    for (let i = 0; i < MAX_PREVIEW_STORAGE_KEYS + 10; i++) {
      oversized[`k_${i}`] = "v";
    }
    const clean = sanitizePreviewState(oversized);
    expect(clean.ok).toBe("hello");
    expect("badNum" in clean).toBe(false);
    expect("" in clean).toBe(false);
    expect(Object.keys(clean).length).toBeLessThanOrEqual(MAX_PREVIEW_STORAGE_KEYS);

    const huge = sanitizePreviewState({
      a: "x".repeat(PREVIEW_STORAGE_LIMIT_BYTES + 100),
      b: "fits",
    });
    expect("a" in huge).toBe(false);
    expect(huge.b).toBe("fits");
  });

  it("validates postMessage source and payload shape", () => {
    const source = {} as MessageEventSource;
    const other = {} as MessageEventSource;
    const okEvent = {
      source,
      data: { source: "atoms-preview", type: "storage", state: { todos: "[]" } },
    } as MessageEvent;
    expect(isPreviewStorageMessage(okEvent, source)).toEqual({ todos: "[]" });
    expect(isPreviewStorageMessage(okEvent, other)).toBeNull();
    expect(
      isPreviewStorageMessage({ source, data: { source: "other" } } as MessageEvent, source),
    ).toBeNull();
  });

  it("embeds escaped initial state and defines localStorage proxy in shim", () => {
    const shim = buildPreviewStorageShim({ note: "</script><script>alert(1)</script>" });
    expect(shim).not.toContain("</script><script>");
    expect(shim).toContain('Object.defineProperty(window, "localStorage"');
    expect(shim).toContain('type: "storage"');
  });
});
