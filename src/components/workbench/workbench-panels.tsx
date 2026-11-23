"use client";

import { useState } from "react";
import { CodePane, type CodeFile } from "./code-pane";
import { PreviewPane } from "./preview-pane";

type WorkbenchPanelsProps = {
  files: CodeFile[];
};

type TabId = "preview" | "code";

export function WorkbenchPanels({ files }: WorkbenchPanelsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("preview");

  return (
    <section
      data-testid="workbench-panels"
      className="flex min-h-64 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div
        role="tablist"
        aria-label="预览与代码"
        className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TabButton
          id="preview"
          label="预览"
          selected={activeTab === "preview"}
          onSelect={setActiveTab}
        />
        <TabButton
          id="code"
          label="代码"
          selected={activeTab === "code"}
          onSelect={setActiveTab}
        />
      </div>

      <div
        role="tabpanel"
        id="workbench-panel-preview"
        aria-labelledby="workbench-tab-preview"
        hidden={activeTab !== "preview"}
        className="min-h-56 flex-1"
      >
        <PreviewPane files={files} />
      </div>

      <div
        role="tabpanel"
        id="workbench-panel-code"
        aria-labelledby="workbench-tab-code"
        hidden={activeTab !== "code"}
        className="min-h-56 flex-1"
      >
        <CodePane files={files} />
      </div>
    </section>
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
          ? "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </button>
  );
}
