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
  previewFrameMaxWidthPx,
  type PreviewWidthMode,
} from "@/lib/preview/width";

type PreviewPaneProps = {
  files: PreviewFile[];
  onProbeReport?: (report: PreviewProbeReport) => void;
};

type BundleResult =
  | { status: "ready"; srcdoc: string; filesRef: PreviewFile[] }
  | { status: "error"; messageZh: string; filesRef: PreviewFile[] };

type PreviewPaintMessage = {
  source?: string;
  type?: string;
  text?: string;
};

export function PreviewPane({ files, onProbeReport }: PreviewPaneProps) {
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [paintedText, setPaintedText] = useState("");
  const [widthMode, setWidthMode] = useState<PreviewWidthMode>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => scheduleEsbuildWasmPreload(), []);

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
        onProbeReport?.(createCompileErrorProbeReport(result.messageZh));
        setBundle({
          status: "error",
          messageZh: result.messageZh,
          filesRef: files,
        });
        return;
      }
      setPaintedText("");
      setBundle({
        status: "ready",
        srcdoc: buildPreviewSrcdoc(result.js, result.css, result.vendorJs),
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
      if (report) onProbeReport?.(report);
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
  }, [onProbeReport]);

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

      <div
        data-testid="preview-frame"
        className="mx-auto h-full min-h-56 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      >
        {/* Accessible paint probe for e2e when iframe content is opaque-origin. */}
        {paintedText ? (
          <span className="sr-only" data-testid="preview-paint-probe">
            {paintedText}
          </span>
        ) : null}
        <iframe
          ref={iframeRef}
          title="应用预览"
          data-testid="preview-iframe"
          sandbox={getPreviewSandboxAttribute()}
          srcDoc={bundle.srcdoc}
          className="h-full min-h-56 w-full border-0 bg-white"
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
          ? "atoms-focus-ring rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "atoms-focus-ring rounded-full px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </button>
  );
}
