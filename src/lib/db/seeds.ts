export type SeedExampleProject = {
  title: string;
  summary: string;
  qaScore: number;
  prd: string;
  acceptance: string[];
  design: {
    files: string[];
    components: string[];
    data: string[];
    notes: string;
  };
  files: Array<{ path: string; content: string }>;
};

export const SEED_EXAMPLE_PROJECTS: SeedExampleProject[] = [
  {
    title: "待办清单示例",
    summary: "已完成的待办清单示例，可添加、筛选、勾选与删除任务。",
    qaScore: 96,
    prd: "实现轻巧直观的中文待办清单应用，支持新增任务、勾选完成状态、按状态筛选以及删除清理。",
    acceptance: [
      "AC-1 页面展示「我的待办」标题与初始示例任务",
      "AC-2 支持输入任务并点击「添加待办」新增条目",
      "AC-3 支持勾选任务完成状态与按全部/未完成/已完成筛选",
    ],
    design: {
      files: ["src/main.tsx", "src/App.tsx"],
      components: ["App"],
      data: [
        "todos: Array<{ id: string; text: string; done: boolean }>",
        "filter: 'all' | 'active' | 'done'",
      ],
      notes: "单页 React + Tailwind CSS，状态完全在浏览器内存中维护，无外部请求。",
    },
    files: [
      {
        path: "src/main.tsx",
        content:
          'import { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);',
      },
      {
        path: "src/App.tsx",
        content: `import { useState } from "react";

type Todo = { id: string; text: string; done: boolean };
type Filter = "all" | "active" | "done";

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: "1", text: "体验 Atoms Studio", done: false },
    { id: "2", text: "查看版本记录", done: true },
  ]);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodos((prev) => [{ id: String(Date.now()), text, done: false }, ...prev]);
    setDraft("");
  }

  const visible = todos.filter((t) =>
    filter === "all" ? true : filter === "active" ? !t.done : t.done,
  );
  const doneCount = todos.filter((t) => t.done).length;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-5 flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">我的待办</h1>
            <p className="mt-1 text-xs text-slate-500">
              已完成 {doneCount} / {todos.length} 项
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {(
              [
                ["all", "全部"],
                ["active", "未完成"],
                ["done", "已完成"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? "rounded-md bg-white px-2.5 py-1 font-medium text-slate-900 shadow-xs"
                    : "rounded-md px-2.5 py-1 text-slate-500 hover:text-slate-800"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入新的待办事项…"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            添加待办
          </button>
        </form>

        <ul className="space-y-2">
          {visible.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() =>
                    setTodos((prev) =>
                      prev.map((item) =>
                        item.id === todo.id ? { ...item, done: !item.done } : item,
                      ),
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                <span className={todo.done ? "text-slate-400 line-through" : "text-slate-800"}>
                  {todo.text}
                </span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setTodos((prev) => prev.filter((item) => item.id !== todo.id))
                }
                className="text-xs text-slate-400 transition hover:text-rose-600"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}`,
      },
    ],
  },
  {
    title: "专注计时器示例",
    summary: "已完成的专注计时器示例，支持 25 分钟专注与 5 分钟短休切换及实时倒计时。",
    qaScore: 94,
    prd: "设计并实现一个简洁直观的番茄专注时钟，支持 25 分钟专注与 5 分钟休息模式切换、开始/暂停倒计时与一键重置。",
    acceptance: [
      "AC-1 页面展示「专注时钟」标题与初始 25:00 倒计时",
      "AC-2 点击「开始专注」启动实时倒计时并可暂停",
      "AC-3 支持切换专注/短休模式并显示「专注结束后休息 5 分钟」提示",
    ],
    design: {
      files: ["src/main.tsx", "src/App.tsx"],
      components: ["App"],
      data: ["mode: 'focus' | 'break'", "secondsLeft: number", "running: boolean"],
      notes: "单页 React + Tailwind CSS，使用 useEffect 驱动 1 秒计时器，支持模式切换与进度条。",
    },
    files: [
      {
        path: "src/main.tsx",
        content:
          'import { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);',
      },
      {
        path: "src/App.tsx",
        content: `import { useEffect, useState } from "react";

const DURATIONS = { focus: 25 * 60, break: 5 * 60 } as const;

export default function App() {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState<number>(DURATIONS.focus);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const total = DURATIONS[mode];
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const progress = Math.round(((total - secondsLeft) / total) * 100);

  function switchMode(next: "focus" | "break") {
    setRunning(false);
    setMode(next);
    setSecondsLeft(DURATIONS[next]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">专注时钟</h1>
        <p className="mt-1 text-xs text-slate-500">专注结束后休息 5 分钟</p>

        <div className="mt-5 inline-flex rounded-full bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => switchMode("focus")}
            className={
              mode === "focus"
                ? "rounded-full bg-white px-3.5 py-1.5 font-medium text-slate-900 shadow-xs"
                : "rounded-full px-3.5 py-1.5 text-slate-500 hover:text-slate-800"
            }
          >
            专注 25 分钟
          </button>
          <button
            type="button"
            onClick={() => switchMode("break")}
            className={
              mode === "break"
                ? "rounded-full bg-white px-3.5 py-1.5 font-medium text-slate-900 shadow-xs"
                : "rounded-full px-3.5 py-1.5 text-slate-500 hover:text-slate-800"
            }
          >
            短休 5 分钟
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-7">
          <p className="font-mono text-5xl font-bold tracking-tight text-indigo-600 tabular-nums">
            {mins}:{secs}
          </p>
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: \`\${progress}%\` }}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {running ? "暂停" : "开始专注"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(DURATIONS[mode]);
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            重置
          </button>
        </div>
      </div>
    </main>
  );
}`,
      },
    ],
  },
];
