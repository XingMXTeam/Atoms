"use client";

import { useMemo, useState } from "react";

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
      className="grid h-full min-h-56 grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      <nav
        aria-label="文件树"
        data-testid="code-file-tree"
        className="overflow-auto border-r border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <ul className="flex flex-col gap-1">
          {sorted.map((file) => {
            const selected = file.path === activePath;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  aria-current={selected ? "page" : undefined}
                  className={
                    selected
                      ? "w-full rounded-lg bg-zinc-900 px-2 py-1.5 text-left text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                >
                  {file.path}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col">
        <div className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {active?.path ?? ""}
        </div>
        <pre
          data-testid="code-source"
          className="flex-1 overflow-auto bg-white p-3 text-xs leading-5 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
        >
          <code>{active?.content ?? ""}</code>
        </pre>
      </div>
    </div>
  );
}
