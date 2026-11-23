import { and, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { messages, projects, runs, usage } from "./schema";

export type Project = {
  id: string;
  deviceId: string;
  title: string;
  currentVersionId: string | null;
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

export interface AppRepository {
  createProject(input: { deviceId: string; title: string }): Promise<Project>;
  getProject(id: string, deviceId: string): Promise<Project | null>;
  listProjects(deviceId: string): Promise<Project[]>;
  createRun(input: { projectId: string; status: string }): Promise<Run>;
  updateRun(id: string, patch: Partial<Pick<Run, "status" | "finishedAt">>): Promise<Run>;
  addMessage(input: {
    projectId: string;
    role: "user" | "agent";
    content: string;
  }): Promise<Message>;
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

function mapProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    deviceId: row.deviceId,
    title: row.title,
    currentVersionId: row.currentVersionId,
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
        .where(and(eq(projects.id, id), eq(projects.deviceId, deviceId)))
        .limit(1);
      const row = rows[0];
      return row ? mapProject(row) : null;
    },

    async listProjects(deviceId) {
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.deviceId, deviceId))
        .orderBy(desc(projects.updatedAt), desc(projects.id));
      return rows.map(mapProject);
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

    async updateRun(id, patch) {
      const updates: Partial<typeof runs.$inferInsert> = {};
      if (patch.status !== undefined) updates.status = patch.status;
      if (patch.finishedAt !== undefined) updates.finishedAt = patch.finishedAt;

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
