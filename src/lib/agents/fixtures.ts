/** Deterministic mock pipeline payloads for unit/e2e (LLM_PROVIDER=mock). */

export type PlannerPayload = {
  title: string;
  prd: string;
  acceptance: string[];
};

export function createMockQaVerdicts(input: {
  acceptance: string[];
  probe: {
    compileErrors: string[];
    runtimeErrors: string[];
    blankScreen: boolean;
  };
}) {
  const errors = [
    ...input.probe.compileErrors,
    ...input.probe.runtimeErrors,
  ];
  const failed = errors.length > 0 || input.probe.blankScreen;
  return {
    verdicts: input.acceptance.map((criterion) => ({
      criterion,
      verdict: failed ? "fail" : "pass",
      reason: failed
        ? errors[0] ?? "预览页面为空"
        : "预览正常显示",
    })),
    ...(failed ? { fixInstruction: `修复预览问题：${errors[0] ?? "页面为空"}` } : {}),
  };
}

export type ArchitectPayload = {
  files: string[];
  components: string[];
  data: string[];
  notes: string;
};

export type GeneratedFile = {
  path: string;
  content: string;
};

export type EngineerPayload = {
  files: GeneratedFile[];
  summary: string;
};

export const MOCK_PLANNER: PlannerPayload = {
  title: "中文待办清单",
  prd: "做一个可添加、勾选和删除事项的简洁待办清单，界面文案全部为中文。",
  acceptance: [
    "AC-1 页面显示标题「我的待办」",
    "AC-2 可以新增一条待办事项",
    "AC-3 可以勾选完成状态",
  ],
};

export const MOCK_ARCHITECT: ArchitectPayload = {
  files: ["src/App.tsx", "src/components/TodoList.tsx", "src/main.tsx"],
  components: ["App", "TodoList"],
  data: ["todos: Array<{ id: string; text: string; done: boolean }>"],
  notes: "单页 React + TS；状态留在 App；无外部请求。",
};

export const MOCK_ENGINEER_FILES: GeneratedFile[] = [
  {
    path: "src/main.tsx",
    content: `import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
`,
  },
  {
    path: "src/App.tsx",
    content: `import { useState } from "react";
import { TodoList } from "./components/TodoList";

type Todo = { id: string; text: string; done: boolean };

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: "1", text: "体验 Atoms Studio", done: false },
  ]);
  const [draft, setDraft] = useState("");

  function addTodo() {
    const text = draft.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: String(Date.now()), text, done: false },
    ]);
    setDraft("");
  }

  return (
    <main data-testid="mock-app" style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>我的待办</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="添加待办…"
          aria-label="待办输入"
        />
        <button type="button" onClick={addTodo}>
          添加
        </button>
      </div>
      <TodoList
        todos={todos}
        onToggle={(id) =>
          setTodos((prev) =>
            prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
          )
        }
      />
    </main>
  );
}
`,
  },
  {
    path: "src/components/TodoList.tsx",
    content: `type Todo = { id: string; text: string; done: boolean };

export function TodoList({
  todos,
  onToggle,
}: {
  todos: Todo[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          <label>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => onToggle(todo.id)}
            />{" "}
            <span style={{ textDecoration: todo.done ? "line-through" : "none" }}>
              {todo.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
`,
  },
];

export const MOCK_ENGINEER: EngineerPayload = {
  files: MOCK_ENGINEER_FILES,
  summary: "已生成可预览的中文待办清单应用骨架。",
};
