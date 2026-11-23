"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTimeline } from "./agent-timeline";
import { WorkbenchPanels, type VersionSummary } from "./workbench-panels";
import type { CodeFile } from "./code-pane";

type RunStatus = "running" | "completed" | "interrupted" | "failed";

type WorkbenchClientProps = {
  projectId: string;
  initialRunId: string;
  initialRunStatus?: string;
  initialRunQaRounds: number;
  initialRunQaScore: number | null;
  initialVersionId: string | null;
  initialVersionRunId: string | null;
  initialVersionQaScore: number | null;
  initialFiles?: CodeFile[];
  initialQaScore?: number | null;
  initialVersions: VersionSummary[];
};

function statusLabelZh(status: RunStatus | string): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "interrupted":
      return "已中断";
    case "failed":
      return "失败";
    default:
      return "运行中";
  }
}

export function WorkbenchClient({
  projectId,
  initialRunId,
  initialRunStatus,
  initialRunQaRounds,
  initialRunQaScore,
  initialVersionId,
  initialVersionRunId,
  initialVersionQaScore,
  initialFiles = [],
  initialQaScore = null,
  initialVersions,
}: WorkbenchClientProps) {
  const [files, setFiles] = useState<CodeFile[]>(initialFiles);
  const [qaScore, setQaScore] = useState<number | null>(initialQaScore);
  const [versions, setVersions] = useState(initialVersions);
  const [currentVersionId, setCurrentVersionId] = useState(initialVersionId);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const initialStatus = (initialRunStatus as RunStatus) || "running";
  const liveRunStatusRef = useRef<RunStatus>(initialStatus);
  const [liveRunStatus, setLiveRunStatus] = useState(initialStatus);

  const handleFiles = useCallback((next: CodeFile[]) => {
    if (liveRunStatusRef.current !== "completed") setFiles(next);
  }, []);

  const handleRunStatus = useCallback((status: RunStatus) => {
    liveRunStatusRef.current = status;
    setLiveRunStatus(status);
  }, []);

  useEffect(() => {
    if (liveRunStatus !== "completed") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/versions`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("无法加载版本记录，请刷新页面重试");
        const result = (await response.json()) as {
          versions: VersionSummary[];
          currentVersionId: string | null;
          files: CodeFile[];
        };
        if (cancelled) return;
        setVersions(result.versions);
        setCurrentVersionId(result.currentVersionId);
        setFiles(result.files);
      } catch (error) {
        if (!cancelled) {
          setRestoreMessage(
            error instanceof Error ? error.message : "无法加载版本记录，请刷新页面重试",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveRunStatus, projectId]);

  const createShareLink = useCallback(async () => {
    setSharing(true);
    setShareError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        shareUrl?: string;
        messageZh?: string;
      };
      if (!response.ok || !result.shareUrl) {
        throw new Error(result.messageZh ?? "创建分享链接失败，请重试");
      }
      setShareUrl(result.shareUrl);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "创建分享链接失败，请重试",
      );
    } finally {
      setSharing(false);
    }
  }, [projectId]);

  const exportCurrentVersion = useCallback(async () => {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/export`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const result = (await response.json()) as { messageZh?: string };
        throw new Error(result.messageZh ?? "下载失败，请重试");
      }
      const archive = await response.blob();
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectId}.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "下载失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [projectId]);

  const restoreVersion = useCallback(async (versionId: string) => {
    setRestoringVersionId(versionId);
    setRestoreMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const result = (await response.json()) as {
        messageZh?: string;
        versionId?: string;
        files?: CodeFile[];
        qaScore?: number | null;
      };
      if (!response.ok || !result.versionId || !Array.isArray(result.files)) {
        throw new Error(result.messageZh ?? "恢复失败，请重试");
      }
      setFiles(result.files);
      setQaScore(result.qaScore ?? null);
      setCurrentVersionId(result.versionId);
      setRestoreMessage("已恢复所选版本");
    } catch (error) {
      setRestoreMessage(
        error instanceof Error ? error.message : "恢复失败，请重试",
      );
    } finally {
      setRestoringVersionId(null);
    }
  }, [projectId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p
          data-testid="workbench-run-status"
          data-run-status={liveRunStatus}
          className="text-sm text-zinc-500 dark:text-zinc-400"
        >
          {statusLabelZh(liveRunStatus)}
        </p>
        {qaScore !== null ? (
          <span
            data-testid="workbench-score-badge"
            data-run-id={initialRunId}
            data-run-qa-rounds={initialRunQaRounds}
            data-run-qa-score={initialRunQaScore ?? ""}
            data-version-id={initialVersionId ?? ""}
            data-version-run-id={initialVersionRunId ?? ""}
            data-version-qa-score={initialVersionQaScore ?? ""}
            className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {qaScore} 分
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportCurrentVersion}
          disabled={exporting || !currentVersionId}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {exporting ? "正在导出…" : "下载 ZIP"}
        </button>
        <button
          type="button"
          onClick={createShareLink}
          disabled={sharing || !currentVersionId}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {sharing ? "正在创建…" : "创建只读分享链接"}
        </button>
        {shareUrl ? (
          <Link
            href={shareUrl}
            className="break-all text-sm text-blue-700 underline underline-offset-2 dark:text-blue-300"
          >
            {shareUrl}
          </Link>
        ) : null}
        {shareError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {shareError}
          </p>
        ) : null}
        {exportError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {exportError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <AgentTimeline
          projectId={projectId}
          initialRunId={initialRunId}
          initialRunStatus={initialRunStatus}
          onFiles={handleFiles}
          onRunStatusChange={handleRunStatus}
          onQaScoreChange={setQaScore}
        />
        <WorkbenchPanels
          files={files}
          versions={versions}
          currentVersionId={currentVersionId}
          restoringVersionId={restoringVersionId}
          restoreMessage={restoreMessage}
          onRestore={restoreVersion}
        />
      </div>
    </div>
  );
}
