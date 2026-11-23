import { and, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { projects, usage } from "./schema";

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

export interface AppRepository {
  createProject(input: { deviceId: string; title: string }): Promise<Project>;
  getProject(id: string, deviceId: string): Promise<Project | null>;
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
