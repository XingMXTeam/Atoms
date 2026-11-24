"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildPreviewSrcdoc,
  bundlePreviewFiles,
  type PreviewFile,
} from "@/lib/preview/bundle";
import { scheduleEsbuildWasmPreload } from "@/lib/preview/preload";
import { getPreviewSandboxAttribute } from "@/lib/preview/sandbox";
import {
  createCompileErrorProbeReport,
  isPreviewProbeMessage,
  type PreviewProbeReport,
} from "@/lib/preview/probe";
import {
  isPreviewStorageMessage,
  sanitizePreviewState,
} from "@/lib/preview/storage-bridge";
import {
  previewFrameMaxWidthPx,
  type PreviewWidthMode,
} from "@/lib/preview/width";

type PreviewPaneProps = {
  files: PreviewFile[];
  /** Optional project id for D1 + localStorage state persistence across reloads. */
  projectId?: string;
  /** Server-loaded initial state snapshot from D1 `project_state`. */
  initialState?: Record<string, string>;
  /** When true (e.g. read-only share pages), state changes stay in memory only. */
  readOnly?: boolean;
  /** `sourceFiles` identifies which file set produced the report (stale-probe guard). */
  onProbeReport?: (report: PreviewProbeReport, sourceFiles: PreviewFile[]) => void;
};

type BundleResult =
  | { status: "ready"; srcdoc: string; filesRef: PreviewFile[]; generation: number }
  | { status: "error"; messageZh: string; filesRef: PreviewFile[] };

type PreviewPaintMessage = {
  source?: string;
  type?: string;
  text?: string;
};

type SyncStatus = "idle" | "saving" | "saved";

function localStateKey(projectId: string): string {
  return `atoms.previewState:${projectId}`;
}

function readLocalCachedState(projectId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(localStateKey(projectId));
    if (!raw) return {};
    return sanitizePreviewState(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeLocalCachedState(projectId: string, state: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localStateKey(projectId), JSON.stringify(state));
  } catch {
    // Ignore storage quota / private mode errors; D1 remains source of truth.
  }
}

export function PreviewPane({
  files,
  projectId,
  initialState,
  readOnly = false,
  onProbeReport,
}: PreviewPaneProps) {
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [paintedText, setPaintedText] = useState("");
  const [remountKey, setRemountKey] = useState(0);
  const [autoRetried, setAutoRetried] = useState(false);
  const [widthMode, setWidthMode] = useState<PreviewWidthMode>("desktop");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    initialState && Object.keys(initialState).length > 0 ? "saved" : "idle",
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Files that produced the currently mounted iframe; probes are attributed to them.
  const renderedFilesRef = useRef<PreviewFile[] | null>(null);
  const generationRef = useRef(0);
  const stateRef = useRef<Record<string, string>>(
    sanitizePreviewState(initialState ?? {}),
  );
  const pendingStateRef = useRef<Record<string, string> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);

  useEffect(() => scheduleEsbuildWasmPreload(), []);

  // Hydrate instant local cache if server D1 snapshot is empty on first mount.
  useEffect(() => {
    if (readOnly || !projectId) return;
    if (Object.keys(stateRef.current).length === 0) {
      const cached = readLocalCachedState(projectId);
      if (Object.keys(cached).length > 0) {
        stateRef.current = cached;
      }
    } else {
      writeLocalCachedState(projectId, stateRef.current);
    }
  }, [projectId, readOnly]);

  // Flush any pending D1 state save on page hide / unmount so fast reloads never drop data.
  useEffect(() => {
    if (readOnly || !projectId) return;
    const flushNow = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingStateRef.current;
      if (!pending) return;
      pendingStateRef.current = null;
      void fetch(`/api/projects/${projectId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: pending }),
        keepalive: true,
      }).catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibility);
      flushNow();
    };
  }, [projectId, readOnly]);

  useEffect(() => {
    if (files.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await bundlePreviewFiles(files);
      if (cancelled) return;
      if (!result.ok) {
        setPaintedText("");
        renderedFilesRef.current = files;
        onProbeReport?.(createCompileErrorProbeReport(result.messageZh), files);
        setBundle({
          status: "error",
          messageZh: result.messageZh,
          filesRef: files,
        });
        return;
      }
      setPaintedText("");
      setAutoRetried(false);
      renderedFilesRef.current = files;
      generationRef.current += 1;
      setBundle({
        status: "ready",
        generation: generationRef.current,
        srcdoc: buildPreviewSrcdoc(
          result.js,
          result.css,
          result.vendorJs,
          result.tailwindJs,
          stateRef.current,
        ),
        filesRef: files,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [files, onProbeReport]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const report = isPreviewProbeMessage(event, iframeRef.current?.contentWindow);
      if (report && renderedFilesRef.current) {
        onProbeReport?.(report, renderedFilesRef.current);
      }

      const nextState = isPreviewStorageMessage(
        event,
        iframeRef.current?.contentWindow,
      );
      if (nextState) {
        const serializedPrev = JSON.stringify(stateRef.current);
        const serializedNext = JSON.stringify(nextState);
        if (serializedNext !== serializedPrev) {
          stateRef.current = nextState;
          if (!readOnly && projectId) {
            writeLocalCachedState(projectId, nextState);
            pendingStateRef.current = nextState;
            const seq = ++saveSeqRef.current;
            setSyncStatus("saving");
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
              saveTimerRef.current = null;
              const payload = pendingStateRef.current;
              if (!payload) return;
              pendingStateRef.current = null;
              void fetch(`/api/projects/${projectId}/state`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: payload }),
              })
                .then((res) => {
                  if (res.ok && saveSeqRef.current === seq) {
                    setSyncStatus("saved");
                  }
                })
                .catch(() => undefined);
            }, 120);
          }
        }
      }

      if (!data || typeof data !== "object") return;
      const message = data as PreviewPaintMessage;
      const text = message.text?.trim();
      if (
        message.source === "atoms-preview" &&
        message.type === "painted" &&
        text
      ) {
        setPaintedText(text);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onProbeReport, projectId, readOnly]);

  // Auto-remount once if the iframe fails to paint within 8s after bundling (#8).
  useEffect(() => {
    if (bundle?.status !== "ready" || paintedText || autoRetried) return;
    const timer = setTimeout(() => {
      setAutoRetried(true);
      setRemountKey((k) => k + 1);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [bundle, paintedText, autoRetried]);

  if (files.length === 0) {
    return (
      <div
        data-testid="preview-pane"
        className="flex h-full min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          等待生成
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          工程师产出文件后，将在此自动打包并预览。
        </p>
      </div>
    );
  }

  const matchesCurrent = bundle?.filesRef === files;

  if (!matchesCurrent) {
    return (
      <div
        data-testid="preview-pane"
        data-preview-status="loading"
        className="flex h-full min-h-56 items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">正在打包预览…</p>
      </div>
    );
  }

  if (bundle.status === "error") {
    return (
      <div
        data-testid="preview-pane"
        data-preview-status="error"
        role="alert"
        className="flex h-full min-h-56 flex-col items-start justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30"
      >
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          预览失败
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {bundle.messageZh}
        </p>
      </div>
    );
  }

  const maxWidth = previewFrameMaxWidthPx(widthMode);

  return (
    <div
      data-testid="preview-pane"
      data-preview-status="ready"
      data-preview-painted={paintedText ? "true" : "false"}
      data-preview-width={widthMode}
      className="flex h-full min-h-56 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="预览宽度"
          data-testid="preview-width-toggle"
          className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <WidthToggleButton
            label="桌面"
            selected={widthMode === "desktop"}
            onSelect={() => setWidthMode("desktop")}
          />
          <WidthToggleButton
            label="移动 375px"
            selected={widthMode === "mobile"}
            onSelect={() => setWidthMode("mobile")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && projectId && syncStatus !== "idle" ? (
            <span
              data-testid="preview-state-sync"
              data-sync-status={syncStatus}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 transition dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            >
              <span
                className={
                  syncStatus === "saving"
                    ? "h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                    : "h-1.5 w-1.5 rounded-full bg-emerald-500"
                }
              />
              {syncStatus === "saving" ? "正在同步状态…" : "状态已持久化"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => iframeRef.current?.contentWindow?.focus()}
            className="atoms-focus-ring rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200"
            title="点击后可直接使用方向键等键盘快捷键"
          >
            点击预览聚焦键盘
          </button>
          <button
            type="button"
            onClick={() => {
              setPaintedText("");
              setRemountKey((k) => k + 1);
            }}
            className="atoms-focus-ring rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            重载预览
          </button>
        </div>
      </div>

      <div
        data-testid="preview-frame"
        className="relative mx-auto h-[560px] min-h-[520px] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs transition-[max-width] duration-200 lg:h-[620px] dark:border-zinc-800 dark:bg-zinc-950"
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      >
        {!paintedText ? (
          <div
            data-testid="preview-mounting-overlay"
            className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
          >
            <span className="rounded-full border border-zinc-200 bg-white/95 px-3 py-1 text-xs text-zinc-600 shadow-xs dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-300">
              {autoRetried ? "正在重新挂载预览…" : "正在准备预览…"}
            </span>
          </div>
        ) : null}
        {/* Accessible paint probe for e2e when iframe content is opaque-origin. */}
        {paintedText ? (
          <span className="sr-only" data-testid="preview-paint-probe">
            {paintedText}
          </span>
        ) : null}
        <iframe
          // Fresh element per bundle or manual/auto remount so late messages from a prior
          // document cannot pass the event.source check and be attributed to new files.
          key={`${bundle.generation}-${remountKey}`}
          ref={iframeRef}
          title="应用预览"
          data-testid="preview-iframe"
          sandbox={getPreviewSandboxAttribute()}
          srcDoc={bundle.srcdoc}
          className="h-full min-h-[520px] w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}

function WidthToggleButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={
        selected
          ? "atoms-focus-ring rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition dark:bg-zinc-100 dark:text-zinc-900"
          : "atoms-focus-ring rounded-full px-3 py-1 text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      }
    >
      {label}
    </button>
  );
}
