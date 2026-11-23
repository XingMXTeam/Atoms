"use client";

import { useCallback, useState } from "react";
import { AgentTimeline } from "./agent-timeline";
import { WorkbenchPanels } from "./workbench-panels";
import type { CodeFile } from "./code-pane";

type WorkbenchClientProps = {
  projectId: string;
  initialRunId: string;
  initialRunStatus?: string;
  initialFiles?: CodeFile[];
};

export function WorkbenchClient({
  projectId,
  initialRunId,
  initialRunStatus,
  initialFiles = [],
}: WorkbenchClientProps) {
  const [files, setFiles] = useState<CodeFile[]>(initialFiles);

  const handleFiles = useCallback((next: CodeFile[]) => {
    setFiles(next);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <AgentTimeline
        projectId={projectId}
        initialRunId={initialRunId}
        initialRunStatus={initialRunStatus}
        onFiles={handleFiles}
      />
      <WorkbenchPanels files={files} />
    </div>
  );
}
