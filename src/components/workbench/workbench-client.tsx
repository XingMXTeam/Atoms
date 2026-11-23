"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [liveRunStatus, setLiveRunStatus] = useState<RunStatus>(
    (initialRunStatus as RunStatus) || "running",
  );

  const handleFiles = useCallback((next: CodeFile[]) => {
    setFiles(next);
  }, []);

  const handleRunStatus = useCallback((status: RunStatus) => {
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
        };
        if (cancelled) return;
        setVersions(result.versions);
        setCurrentVersionId(result.currentVersionId);
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
