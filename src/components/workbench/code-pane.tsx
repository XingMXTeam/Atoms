"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type CodeFile = {
  path: string;
  content: string;
};

type CodePaneProps = {
  files: CodeFile[];
};

export function CodePane({ files }: CodePaneProps) {
  const sorted = useMemo(
    () => [...files].sort((a, b) => a.path.localeCompare(b.path, "zh-CN")),
    [files],
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(
    sorted[0]?.path ?? null,
  );
  const [wrapLines, setWrapLines] = useState(false);

  const activePath =
    selectedPath && sorted.some((f) => f.path === selectedPath)
      ? selectedPath
      : (sorted[0]?.path ?? null);
  const active = sorted.find((f) => f.path === activePath) ?? null;

  if (sorted.length === 0) {
    return (
      <div
        data-testid="code-pane"
        className="flex h-full min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          暂无代码
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          工程师完成生成后，这里会显示文件树与源码。
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="code-pane"
      className="grid h-full min-h-56 min-w-0 grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 sm:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)]"
    >
      <nav
        aria-label="文件树"
        data-testid="code-file-tree"
        className="min-w-0 overflow-auto border-r border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <ul className="flex flex-col gap-1">
          {sorted.map((file) => {
            const selected = file.path === activePath;
            return (
              <li key={file.path} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "atoms-focus-ring w-full truncate rounded-lg px-2 py-1.5 text-left text-xs transition",
                    selected
                      ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                  title={file.path}
                >
                  {file.path}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <span className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {active?.path ?? ""}
          </span>
          <button
            type="button"
            className="atoms-focus-ring shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-pressed={wrapLines}
            onClick={() => setWrapLines((value) => !value)}
          >
            {wrapLines ? "横向滚动" : "自动换行"}
          </button>
        </div>
        <pre
          data-testid="code-source"
          data-wrap={wrapLines ? "true" : "false"}
          className={cn(
            "flex-1 bg-white p-3 text-xs leading-5 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
            wrapLines
              ? "overflow-auto whitespace-pre-wrap break-words"
              : "overflow-auto whitespace-pre",
          )}
        >
          <code>{active?.content ?? ""}</code>
        </pre>
      </div>
    </div>
  );
}
