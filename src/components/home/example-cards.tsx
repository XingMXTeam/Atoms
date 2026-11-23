"use client";

export type ExamplePrompt = {
  id: string;
  title: string;
  prompt: string;
};

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "todo",
    title: "待办清单",
    prompt: "做一个简洁的待办清单应用，支持添加、完成和删除任务",
  },
  {
    id: "pomodoro",
    title: "番茄钟",
    prompt: "做一个番茄钟计时器，支持专注与休息切换，并显示剩余时间",
  },
  {
    id: "calculator",
    title: "计算器",
    prompt: "做一个基础计算器，支持加减乘除和清除",
  },
  {
    id: "weather",
    title: "天气卡片",
    prompt: "做一个天气卡片界面，展示城市名称、温度和简短天气描述",
  },
];

type ExampleCardsProps = {
  onSelect: (prompt: string) => void;
};

export function ExampleCards({ onSelect }: ExampleCardsProps) {
  return (
    <ul className="grid w-full gap-3 sm:grid-cols-2">
      {EXAMPLE_PROMPTS.map((example) => (
        <li key={example.id}>
          <button
            type="button"
            aria-label={`示例：${example.prompt}`}
            onClick={() => onSelect(example.prompt)}
            className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100"
          >
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {example.title}
            </span>
            <span className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {example.prompt}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
