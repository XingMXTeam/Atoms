"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildPreviewSrcdoc,
  bundlePreviewFiles,
  type PreviewFile,
} from "@/lib/preview/bundle";
import { getPreviewSandboxAttribute } from "@/lib/preview/sandbox";

type PreviewPaneProps = {
  files: PreviewFile[];
};

type BundleResult =
  | { status: "ready"; srcdoc: string; filesRef: PreviewFile[] }
  | { status: "error"; messageZh: string; filesRef: PreviewFile[] };

type PreviewPaintMessage = {
  source?: string;
  type?: string;
  text?: string;
};

export function PreviewPane({ files }: PreviewPaneProps) {
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [paintedText, setPaintedText] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  }, [files]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (
        event.source !== iframeRef.current?.contentWindow ||
        !data ||
        typeof data !== "object"
      ) {
        return;
      }
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
  }, []);

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

  return (
    <div
      data-testid="preview-pane"
      data-preview-status="ready"
      data-preview-painted={paintedText ? "true" : "false"}
      className="h-full min-h-56 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
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
  );
}
