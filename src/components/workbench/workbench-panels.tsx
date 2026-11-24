"use client";

import { useState } from "react";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import { CodePane, type CodeFile } from "./code-pane";
import { PreviewPane } from "./preview-pane";

export type VersionSummary = {
  id: string;
  summary: string;
  qaScore: number | null;
};

export type TabId = "preview" | "code" | "versions";

type WorkbenchPanelsProps = {
  files: CodeFile[];
  versions: VersionSummary[];
  currentVersionId: string | null;
  restoringVersionId: string | null;
  restoreMessage: string;
  restoreError?: string;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  onRestore: (versionId: string) => void;
  onProbeReport?: (report: PreviewProbeReport) => void;
};

export function WorkbenchPanels({
  files,
  versions,
  currentVersionId,
  restoringVersionId,
  restoreMessage,
  restoreError = "",
  activeTab,
  onTabChange,
  onRestore,
  onProbeReport,
}: WorkbenchPanelsProps) {
  const [internalTab, setInternalTab] = useState<TabId>("preview");
  const currentTab = activeTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  return (
    <section
      data-testid="workbench-panels"
      className="flex min-h-64 min-w-0 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div
        role="tablist"
        aria-label="预览与代码"
        className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TabButton
          id="preview"
          label="预览"
          selected={currentTab === "preview"}
          onSelect={setTab}
        />
        <TabButton
          id="code"
          label="代码"
          selected={currentTab === "code"}
          onSelect={setTab}
        />
        <TabButton
          id="versions"
          label="版本"
          selected={currentTab === "versions"}
          onSelect={setTab}
        />
      </div>

      {restoreError ? (
        <p
          data-testid="restore-error-banner"
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          {restoreError}
        </p>
      ) : null}

      {restoreMessage ? (
        <p
          data-testid="restore-status-banner"
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          {restoreMessage}
        </p>
      ) : null}

      <div
        role="tabpanel"
        id="workbench-panel-preview"
        aria-labelledby="workbench-tab-preview"
        hidden={currentTab !== "preview"}
        className="min-h-56 flex-1"
      >
        <PreviewPane files={files} onProbeReport={onProbeReport} />
      </div>

      <div
        role="tabpanel"
        id="workbench-panel-code"
        aria-labelledby="workbench-tab-code"
        hidden={currentTab !== "code"}
        className="min-h-56 flex-1"
      >
        <CodePane files={files} />
      </div>

      <div
        role="tabpanel"
        id="workbench-panel-versions"
        aria-labelledby="workbench-tab-versions"
        hidden={currentTab !== "versions"}
        className="min-h-56 flex-1"
      >
        <VersionTimeline
          versions={versions}
          currentVersionId={currentVersionId}
          restoringVersionId={restoringVersionId}
          onRestore={onRestore}
        />
      </div>
    </section>
  );
}

function VersionTimeline({
  versions,
  currentVersionId,
  restoringVersionId,
  onRestore,
}: {
  versions: VersionSummary[];
  currentVersionId: string | null;
  restoringVersionId: string | null;
  onRestore: (versionId: string) => void;
}) {
  return (
    <div data-testid="version-timeline" className="flex flex-col gap-3">
      {versions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          暂无版本记录。完成一次生成后，版本会显示在这里。
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {[...versions].reverse().map((version, index) => {
            const isCurrent = version.id === currentVersionId;
            const pending = restoringVersionId === version.id;
            return (
              <li
                key={version.id}
                data-testid="version-row"
                data-version-id={version.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {version.summary}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    版本 {versions.length - index} · {version.qaScore === null ? "暂无评分" : `QA ${version.qaScore} 分`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isCurrent ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      当前版本
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={restoringVersionId !== null}
                      onClick={() => onRestore(version.id)}
                      className="atoms-focus-ring rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      {pending ? "正在恢复…" : "恢复此版本"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function TabButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: TabId;
  label: string;
  selected: boolean;
  onSelect: (id: TabId) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`workbench-tab-${id}`}
      aria-selected={selected}
      aria-controls={`workbench-panel-${id}`}
      data-testid={`workbench-tab-${id}`}
      onClick={() => onSelect(id)}
      className={
        selected
          ? "atoms-focus-ring atoms-tab-btn rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "atoms-focus-ring atoms-tab-btn rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </button>
  );
}
