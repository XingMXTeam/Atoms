"use client";

import { useCallback, useState } from "react";
import { AgentTimeline } from "./agent-timeline";
import { WorkbenchPanels } from "./workbench-panels";
import type { CodeFile } from "./code-pane";

type RunStatus = "running" | "completed" | "interrupted" | "failed";

type WorkbenchClientProps = {
  projectId: string;
  initialRunId: string;
  initialRunStatus?: string;
  initialFiles?: CodeFile[];
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
  initialFiles = [],
}: WorkbenchClientProps) {
  const [files, setFiles] = useState<CodeFile[]>(initialFiles);
  const [liveRunStatus, setLiveRunStatus] = useState<RunStatus>(
    (initialRunStatus as RunStatus) || "running",
  );

  const handleFiles = useCallback((next: CodeFile[]) => {
    setFiles(next);
  }, []);

  const handleRunStatus = useCallback((status: RunStatus) => {
    setLiveRunStatus(status);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p
        data-testid="workbench-run-status"
        data-run-status={liveRunStatus}
        className="text-sm text-zinc-500 dark:text-zinc-400"
      >
        {statusLabelZh(liveRunStatus)}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <AgentTimeline
          projectId={projectId}
          initialRunId={initialRunId}
          initialRunStatus={initialRunStatus}
          onFiles={handleFiles}
          onRunStatusChange={handleRunStatus}
        />
        <WorkbenchPanels files={files} />
      </div>
    </div>
  );
}
