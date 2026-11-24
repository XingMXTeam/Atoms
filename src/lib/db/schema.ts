import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  title: text("title").notNull(),
  currentVersionId: text("current_version_id"),
  shareSlug: text("share_slug"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("projects_share_slug_unique").on(table.shareSlug)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  role: text("role", { enum: ["user", "agent"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  status: text("status").notNull(),
  qaRounds: integer("qa_rounds").notNull().default(0),
  qaScore: integer("qa_score"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const agentEvents = sqliteTable("agent_events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  seq: integer("seq").notNull(),
  agent: text("agent", {
    enum: ["planner", "architect", "engineer", "qa"],
  }).notNull(),
  type: text("type", {
    enum: ["plan", "design", "file", "probe", "verdict", "fix", "error"],
  }).notNull(),
  payload: text("payload", { mode: "json" }).notNull().$type<unknown>(),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  parentId: text("parent_id"),
  files: text("files", { mode: "json" }).notNull().$type<unknown>(),
  acceptance: text("acceptance", { mode: "json" }).notNull().$type<unknown>(),
  qaScore: integer("qa_score"),
  summary: text("summary"),
});

export const usage = sqliteTable(
  "usage",
  {
    deviceId: text("device_id").notNull(),
    day: text("day").notNull(),
    runs: integer("runs").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.deviceId, table.day] })],
);

export const previewProbes = sqliteTable(
  "preview_probes",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    round: integer("round").notNull(),
    report: text("report", { mode: "json" }).notNull().$type<unknown>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.round] })],
);

export type ProjectRow = typeof projects.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
