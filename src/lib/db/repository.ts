import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import {
  agentEvents,
  messages,
  projects,
  runs,
  usage,
  versions,
} from "./schema";

export type Project = {
  id: string;
  deviceId: string;
  title: string;
  currentVersionId: string | null;
  qaScore: number | null;
  shareSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UsageRecord = {
  deviceId: string;
  day: string;
  runs: number;
  tokens: number;
};

export type Run = {
  id: string;
  projectId: string;
  status: string;
  qaRounds: number;
  qaScore: number | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: Date;
  finishedAt: Date | null;
};

export type Message = {
  id: string;
  projectId: string;
  role: "user" | "agent";
  content: string;
  createdAt: Date;
};

export type AgentEvent = {
  id: string;
  runId: string;
  seq: number;
  agent: "planner" | "architect" | "engineer" | "qa";
  type: "plan" | "design" | "file" | "probe" | "verdict" | "fix" | "error";
  payload: unknown;
};

export type Version = {
  id: string;
  projectId: string;
  runId: string;
  parentId: string | null;
  files: unknown;
  acceptance: unknown;
  qaScore: number | null;
  summary: string | null;
};

export interface AppRepository {
  createProject(input: { deviceId: string; title: string }): Promise<Project>;
  getProject(id: string, deviceId: string): Promise<Project | null>;
  listProjects(deviceId: string): Promise<Project[]>;
  ensureSeedProjects(deviceId: string): Promise<void>;
  getProjectByShareSlug(shareSlug: string): Promise<Project | null>;
  ensureShareSlug(projectId: string, shareSlug: string): Promise<string | null>;
  updateProjectTitle(id: string, title: string): Promise<Project>;
  createRun(input: { projectId: string; status: string }): Promise<Run>;
  getRun(id: string): Promise<Run | null>;
  getVersion(id: string): Promise<Version | null>;
  listVersions(projectId: string): Promise<Version[]>;
  updateRun(
    id: string,
    patch: Partial<Pick<Run, "status" | "finishedAt" | "qaRounds" | "qaScore">>,
  ): Promise<Run>;
  addMessage(input: {
    projectId: string;
    role: "user" | "agent";
    content: string;
  }): Promise<Message>;
  listMessages(projectId: string): Promise<Message[]>;
  appendAgentEvent(input: Omit<AgentEvent, "id">): Promise<AgentEvent>;
  listAgentEvents(runId: string): Promise<AgentEvent[]>;
  createVersion(input: {
    projectId: string;
    runId: string;
    files: unknown;
    acceptance: unknown;
    summary: string;
    qaScore?: number | null;
    parentId?: string | null;
  }): Promise<Version>;
  setCurrentVersion(projectId: string, versionId: string): Promise<void>;
  incrementUsage(
    deviceId: string,
    day: string,
    delta: { runs?: number; tokens?: number },
  ): Promise<UsageRecord>;
  getUsage(deviceId: string, day: string): Promise<UsageRecord | null>;
}

export type AppDb =
  | BetterSQLite3Database<typeof schema>
  | DrizzleD1Database<typeof schema>;

function mapProject(
  row: typeof projects.$inferSelect,
  qaScore: number | null = null,
): Project {
  return {
    id: row.id,
    deviceId: row.deviceId,
    title: row.title,
    currentVersionId: row.currentVersionId,
    qaScore,
    shareSlug: row.shareSlug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUsage(row: typeof usage.$inferSelect): UsageRecord {
  return {
    deviceId: row.deviceId,
    day: row.day,
    runs: row.runs,
    tokens: row.tokens,
  };
}

function mapRun(row: typeof runs.$inferSelect): Run {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    qaRounds: row.qaRounds,
    qaScore: row.qaScore,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function mapMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    projectId: row.projectId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function mapAgentEvent(row: typeof agentEvents.$inferSelect): AgentEvent {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    agent: row.agent,
    type: row.type,
    payload: row.payload,
  };
}

function mapVersion(row: typeof versions.$inferSelect): Version {
  return {
    id: row.id,
    projectId: row.projectId,
    runId: row.runId,
    parentId: row.parentId,
    files: row.files,
    acceptance: row.acceptance,
    qaScore: row.qaScore,
    summary: row.summary,
  };
}

export function createAppRepository(db: AppDb): AppRepository {
  return {
    async createProject(input) {
      const now = new Date();
      const id = crypto.randomUUID();
      const row = {
        id,
        deviceId: input.deviceId,
        title: input.title,
        currentVersionId: null,
        shareSlug: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(projects).values(row);
      return mapProject(row);
    },

    async getProject(id, deviceId) {
      const rows = await db
        .select()
        .from(projects)
        .leftJoin(versions, eq(projects.currentVersionId, versions.id))
        .where(and(eq(projects.id, id), eq(projects.deviceId, deviceId)))
        .limit(1);
      const row = rows[0];
      return row
        ? mapProject(row.projects, row.versions?.qaScore ?? null)
        : null;
    },

    async listProjects(deviceId) {
      const rows = await db
        .select()
        .from(projects)
        .leftJoin(versions, eq(projects.currentVersionId, versions.id))
        .where(eq(projects.deviceId, deviceId))
        .orderBy(desc(projects.updatedAt), desc(projects.id));
      return rows.map(({ projects: project, versions: version }) =>
        mapProject(project, version?.qaScore ?? null),
      );
    },

    async ensureSeedProjects(deviceId) {
      if ((await this.listProjects(deviceId)).length > 0) return;

      const examples = [
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
            data: ["todos: Array<{ id: string; text: string; done: boolean }>", "filter: 'all' | 'active' | 'done'"],
            notes: "单页 React + Tailwind CSS，状态完全在浏览器内存中维护，无外部请求。",
          },
          files: [
            {
              path: "src/main.tsx",
              content: 'import { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);',
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
              content: 'import { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);',
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

      for (const example of examples) {
        const project = await this.createProject({ deviceId, title: example.title });
        const run = await this.createRun({ projectId: project.id, status: "completed" });
        await this.updateRun(run.id, {
          status: "completed",
          qaScore: example.qaScore,
          finishedAt: new Date(),
        });
        await this.addMessage({
          projectId: project.id,
          role: "user",
          content: example.prd,
        });
        await this.addMessage({
          projectId: project.id,
          role: "agent",
          content: example.summary,
        });

        await this.appendAgentEvent({
          runId: run.id,
          seq: 1,
          agent: "planner",
          type: "plan",
          payload: {
            title: example.title,
            prd: example.prd,
            acceptance: example.acceptance,
          },
        });
        await this.appendAgentEvent({
          runId: run.id,
          seq: 2,
          agent: "architect",
          type: "design",
          payload: example.design,
        });
        await this.appendAgentEvent({
          runId: run.id,
          seq: 3,
          agent: "engineer",
          type: "file",
          payload: {
            files: example.files,
            summary: example.summary,
          },
        });
        await this.appendAgentEvent({
          runId: run.id,
          seq: 4,
          agent: "qa",
          type: "probe",
          payload: {
            round: 0,
            report: {
              source: "atoms-preview",
              type: "probe",
              compileErrors: [],
              runtimeErrors: [],
              blankScreen: false,
              domSummary: {
                title: example.title,
                text: example.summary,
                elementCount: 12,
              },
            },
          },
        });
        await this.appendAgentEvent({
          runId: run.id,
          seq: 5,
          agent: "qa",
          type: "verdict",
          payload: {
            round: 0,
            verdicts: example.acceptance.map((criterion) => ({
              criterion,
              verdict: "pass",
              reason: "预览正常渲染且交互可用",
            })),
            qa_score: example.qaScore,
          },
        });

        const version = await this.createVersion({
          projectId: project.id,
          runId: run.id,
          files: example.files,
          acceptance: example.acceptance,
          summary: example.summary,
          qaScore: example.qaScore,
        });
        await this.setCurrentVersion(project.id, version.id);
      }
    },

    async getProjectByShareSlug(shareSlug) {
      const rows = await db
        .select()
        .from(projects)
        .leftJoin(versions, eq(projects.currentVersionId, versions.id))
        .where(eq(projects.shareSlug, shareSlug))
        .limit(1);
      const row = rows[0];
      return row ? mapProject(row.projects, row.versions?.qaScore ?? null) : null;
    },

    async ensureShareSlug(projectId, shareSlug) {
      await db
        .update(projects)
        .set({ shareSlug, updatedAt: new Date() })
        .where(and(eq(projects.id, projectId), sql`${projects.shareSlug} IS NULL`));
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      return rows[0]?.shareSlug ?? null;
    },

    async updateProjectTitle(id, title) {
      const now = new Date();
      await db
        .update(projects)
        .set({ title, updatedAt: now })
        .where(eq(projects.id, id));
      const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error(`project missing after title update (${id})`);
      }
      return mapProject(row);
    },

    async createRun(input) {
      const now = new Date();
      const id = crypto.randomUUID();
      const row = {
        id,
        projectId: input.projectId,
        status: input.status,
        qaRounds: 0,
        qaScore: null,
        tokensIn: 0,
        tokensOut: 0,
        startedAt: now,
        finishedAt: null,
      };
      await db.insert(runs).values(row);
      return mapRun(row);
    },

    async getRun(id) {
      const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
      const row = rows[0];
      return row ? mapRun(row) : null;
    },

    async getVersion(id) {
      const rows = await db.select().from(versions).where(eq(versions.id, id)).limit(1);
      const row = rows[0];
      return row ? mapVersion(row) : null;
    },

    async listVersions(projectId) {
      const rows = await db
        .select()
        .from(versions)
        .where(eq(versions.projectId, projectId));
      const withRunTimes = await Promise.all(
        rows.map(async (version) => {
          const runRows = await db
            .select()
            .from(runs)
            .where(eq(runs.id, version.runId))
            .limit(1);
          return { version, startedAt: runRows[0]?.startedAt.getTime() ?? 0 };
        }),
      );
      return withRunTimes
        .sort(
          (a, b) =>
            a.startedAt - b.startedAt || a.version.id.localeCompare(b.version.id),
        )
        .map(({ version }) => mapVersion(version));
    },

    async updateRun(id, patch) {
      const updates: Partial<typeof runs.$inferInsert> = {};
      if (patch.status !== undefined) updates.status = patch.status;
      if (patch.finishedAt !== undefined) updates.finishedAt = patch.finishedAt;
      if (patch.qaRounds !== undefined) updates.qaRounds = patch.qaRounds;
      if (patch.qaScore !== undefined) updates.qaScore = patch.qaScore;

      await db.update(runs).set(updates).where(eq(runs.id, id));

      const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error(`run missing after update (${id})`);
      }
      return mapRun(row);
    },

    async addMessage(input) {
      const now = new Date();
      const id = crypto.randomUUID();
      const row = {
        id,
        projectId: input.projectId,
        role: input.role,
        content: input.content,
        createdAt: now,
      };
      await db.insert(messages).values(row);
      return mapMessage(row);
    },

    async listMessages(projectId) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.projectId, projectId))
        .orderBy(asc(messages.createdAt));
      return rows.map(mapMessage);
    },

    async appendAgentEvent(input) {
      const id = crypto.randomUUID();
      const row = {
        id,
        runId: input.runId,
        seq: input.seq,
        agent: input.agent,
        type: input.type,
        payload: input.payload,
      };
      await db.insert(agentEvents).values(row);
      return mapAgentEvent(row);
    },

    async listAgentEvents(runId) {
      const rows = await db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.runId, runId))
        .orderBy(asc(agentEvents.seq));
      return rows.map(mapAgentEvent);
    },

    async createVersion(input) {
      const id = crypto.randomUUID();
      const row = {
        id,
        projectId: input.projectId,
        runId: input.runId,
        parentId: input.parentId ?? null,
        files: input.files,
        acceptance: input.acceptance,
        qaScore: input.qaScore ?? null,
        summary: input.summary,
      };
      await db.insert(versions).values(row);
      return mapVersion(row);
    },

    async setCurrentVersion(projectId, versionId) {
      const now = new Date();
      await db
        .update(projects)
        .set({ currentVersionId: versionId, updatedAt: now })
        .where(eq(projects.id, projectId));
    },

    async incrementUsage(deviceId, day, delta) {
      const runsDelta = delta.runs ?? 0;
      const tokensDelta = delta.tokens ?? 0;

      await db
        .insert(usage)
        .values({
          deviceId,
          day,
          runs: runsDelta,
          tokens: tokensDelta,
        })
        .onConflictDoUpdate({
          target: [usage.deviceId, usage.day],
          set: {
            runs: sql`${usage.runs} + ${runsDelta}`,
            tokens: sql`${usage.tokens} + ${tokensDelta}`,
          },
        });

      const row = await this.getUsage(deviceId, day);
      if (!row) {
        throw new Error(`usage row missing after increment (${deviceId}, ${day})`);
      }
      return row;
    },

    async getUsage(deviceId, day) {
      const rows = await db
        .select()
        .from(usage)
        .where(and(eq(usage.deviceId, deviceId), eq(usage.day, day)))
        .limit(1);
      const row = rows[0];
      return row ? mapUsage(row) : null;
    },
  };
}
