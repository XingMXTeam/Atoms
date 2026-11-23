/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_WASM_PATH } from "./vendor";
import { scheduleEsbuildWasmPreload } from "./preload";

describe("scheduleEsbuildWasmPreload (REQ-4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("schedules a low-priority fetch via requestIdleCallback when available", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const callbacks: Array<() => void> = [];
    const requestIdleCallback = vi.fn((cb: () => void) => {
      callbacks.push(cb);
      return 7;
    });
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

    const cancel = scheduleEsbuildWasmPreload();
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    callbacks[0]?.();
    expect(fetchMock).toHaveBeenCalledWith(
      PREVIEW_WASM_PATH,
      expect.objectContaining({
        credentials: "same-origin",
        cache: "force-cache",
      }),
    );

    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it("falls back to a timer when requestIdleCallback is missing", () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("requestIdleCallback", undefined);

    const cancel = scheduleEsbuildWasmPreload("/preview/esbuild.wasm");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_300);
    expect(fetchMock).toHaveBeenCalledWith(
      "/preview/esbuild.wasm",
      expect.objectContaining({ credentials: "same-origin" }),
    );

    cancel();
    vi.useRealTimers();
  });

  it("cancel prevents the idle fetch from running", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const callbacks: Array<() => void> = [];
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
      callbacks.push(cb);
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    const cancel = scheduleEsbuildWasmPreload();
    cancel();
    callbacks[0]?.();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
