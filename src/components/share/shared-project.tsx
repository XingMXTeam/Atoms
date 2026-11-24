"use client";

import { useState } from "react";
import { CodePane, type CodeFile } from "@/components/workbench/code-pane";
import { PreviewPane } from "@/components/workbench/preview-pane";

type SharedProjectProps = {
  title: string;
  summary: string;
  qaScore: number | null;
  files: CodeFile[];
};

type TabId = "preview" | "code";

export function SharedProject({
  title,
  summary,
  qaScore,
  files,
}: SharedProjectProps) {
  const [activeTab, setActiveTab] = useState<TabId>("preview");

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-6 overflow-x-clip px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Atoms Studio · 项目分享</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{summary}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          只读分享
        </span>
      </header>

      <section className="flex min-h-[620px] flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div
          role="tablist"
          aria-label="分享项目内容"
          className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <TabButton id="preview" label="预览" selected={activeTab === "preview"} onSelect={setActiveTab} />
          <TabButton id="code" label="代码" selected={activeTab === "code"} onSelect={setActiveTab} />
        </div>
        <div
          role="tabpanel"
          id="share-panel-preview"
          aria-labelledby="share-tab-preview"
          hidden={activeTab !== "preview"}
          className="min-h-64 flex-1"
        >
          <PreviewPane files={files} readOnly />
        </div>
        <div
          role="tabpanel"
          id="share-panel-code"
          aria-labelledby="share-tab-code"
          hidden={activeTab !== "code"}
          className="min-h-64 flex-1"
        >
          <CodePane files={files} />
        </div>
      </section>
      {qaScore !== null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">QA 评分：{qaScore} 分</p>
      ) : null}
    </main>
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
      id={`share-tab-${id}`}
      aria-selected={selected}
      aria-controls={`share-panel-${id}`}
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
