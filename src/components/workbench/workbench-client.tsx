"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTimeline } from "./agent-timeline";
import { WorkbenchPanels, type TabId, type VersionSummary } from "./workbench-panels";
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
  initialProviderLabel?: string | null;
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
  initialProviderLabel = null,
}: WorkbenchClientProps) {
  const [files, setFiles] = useState<CodeFile[]>(initialFiles);
  const [qaScore, setQaScore] = useState<number | null>(initialQaScore);
  const [qaRounds, setQaRounds] = useState(initialRunQaRounds);
  const [activeRunId, setActiveRunId] = useState(initialRunId);
  const [providerLabel, setProviderLabel] = useState<string | null>(
    initialProviderLabel,
  );
  const [versions, setVersions] = useState(initialVersions);
  const [currentVersionId, setCurrentVersionId] = useState(initialVersionId);
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const initialStatus = (initialRunStatus as RunStatus) || "running";
  const liveRunStatusRef = useRef<RunStatus>(initialStatus);
  const [liveRunStatus, setLiveRunStatus] = useState(initialStatus);
  const lastSyncedCompletedRunRef = useRef<string | null>(
    initialStatus === "completed" ? initialRunId : null,
  );

  const handleFiles = useCallback((next: CodeFile[]) => {
    if (liveRunStatusRef.current !== "completed") setFiles(next);
  }, []);

  const handleRunStatus = useCallback((status: RunStatus) => {
    liveRunStatusRef.current = status;
    setLiveRunStatus(status);
  }, []);

  useEffect(() => {
    if (liveRunStatus !== "completed") return;
    if (lastSyncedCompletedRunRef.current === activeRunId) return;
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
        lastSyncedCompletedRunRef.current = activeRunId;
        setVersions(result.versions);
        setCurrentVersionId(result.currentVersionId);
        setFiles(result.files);
      } catch (error) {
        if (!cancelled) {
          setRestoreError(
            error instanceof Error ? error.message : "无法加载版本记录，请刷新页面重试",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRunId, liveRunStatus, projectId]);

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
    setRestoreError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const result = (await response.json()) as {
        messageZh?: string;
        versionId?: string;
        runId?: string;
        files?: CodeFile[];
        qaScore?: number | null;
      };
      if (!response.ok || !result.versionId || !Array.isArray(result.files)) {
        throw new Error(result.messageZh ?? "恢复失败，请重试");
      }
      if (result.runId) {
        lastSyncedCompletedRunRef.current = result.runId;
        setActiveRunId(result.runId);
      }
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("run");
        window.history.replaceState({}, "", url.toString());
      }
      setFiles(result.files);
      setQaScore(result.qaScore ?? null);
      setCurrentVersionId(result.versionId);
      setRestoreMessage("已恢复所选版本，预览已更新");
      setActiveTab("preview");
    } catch (error) {
      setRestoreError(
        error instanceof Error ? error.message : "恢复失败，请重试",
      );
    } finally {
      setRestoringVersionId(null);
    }
  }, [projectId]);

  const hitQaCap = qaRounds >= 3;

  return (
    <div className="flex flex-col gap-4">
      {providerLabel === "演示回放" ? (
        <p
          data-testid="ux-banner-replay"
          role="status"
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-100"
        >
          演示回放 — 当前使用预录演示结果，便于在额度或上游不可用时继续体验。
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          data-testid="workbench-run-status"
          data-run-status={liveRunStatus}
          className="text-sm text-zinc-500 dark:text-zinc-400"
        >
          {statusLabelZh(liveRunStatus)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="workbench-qa-rounds"
            data-run-qa-rounds={qaRounds}
            className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            质检轮次 {qaRounds}
            {hitQaCap ? " · 已达修复上限" : ""}
          </span>
          {qaScore !== null ? (
            <span
              data-testid="workbench-score-badge"
              data-run-id={activeRunId}
              data-run-qa-rounds={qaRounds}
              data-run-qa-score={qaScore}
              data-version-id={currentVersionId ?? initialVersionId ?? ""}
              data-version-run-id={initialVersionRunId ?? ""}
              data-version-qa-score={initialVersionQaScore ?? ""}
              className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {qaScore} 分
            </span>
          ) : null}
        </div>
      </div>

      {hitQaCap ? (
        <p
          data-testid="ux-banner-qa-cap-meta"
          role="status"
          className="text-sm text-amber-700 dark:text-amber-300"
        >
          已达修复上限
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportCurrentVersion}
          disabled={exporting || !currentVersionId}
          className="atoms-focus-ring rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {exporting ? "正在导出…" : "下载 ZIP"}
        </button>
        <button
          type="button"
          onClick={createShareLink}
          disabled={sharing || !currentVersionId}
          className="atoms-focus-ring rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
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
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <AgentTimeline
          projectId={projectId}
          initialRunId={initialRunId}
          initialRunStatus={initialRunStatus}
          onFiles={handleFiles}
          onRunStatusChange={handleRunStatus}
          onQaScoreChange={setQaScore}
          onQaRoundsChange={setQaRounds}
          onProviderLabel={setProviderLabel}
          onRunIdChange={setActiveRunId}
        />
        <WorkbenchPanels
          files={files}
          versions={versions}
          currentVersionId={currentVersionId}
          restoringVersionId={restoringVersionId}
          restoreMessage={restoreMessage}
          restoreError={restoreError}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRestore={restoreVersion}
        />
      </div>
    </div>
  );
}
