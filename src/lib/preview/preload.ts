import { PREVIEW_WASM_PATH } from "./vendor";

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number };

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    opts?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Warm the browser HTTP cache for esbuild.wasm while the shell is idle (REQ-4).
 * Uses requestIdleCallback when available; otherwise a low-priority fetch on a timer.
 * Returns a cancel function.
 */
export function scheduleEsbuildWasmPreload(
  wasmPath: string = PREVIEW_WASM_PATH,
): () => void {
  if (typeof window === "undefined") return () => {};

  const win = window as IdleWindow;
  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (cancelled) return;
    void fetch(wasmPath, {
      // Hint only — ignored in some browsers but harmless.
      priority: "low",
      credentials: "same-origin",
      cache: "force-cache",
    } as RequestInit).catch(() => {
      /* preload is best-effort */
    });
  };

  if (typeof win.requestIdleCallback === "function") {
    idleHandle = win.requestIdleCallback(run, { timeout: 4_000 });
  } else {
    timeoutHandle = setTimeout(run, 1_200);
  }

  return () => {
    cancelled = true;
    if (idleHandle !== null && typeof win.cancelIdleCallback === "function") {
      win.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  };
}
