import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { SEED_EXAMPLE_PROJECTS } from "./seeds";
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

      for (const example of SEED_EXAMPLE_PROJECTS) {
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
        .leftJoin(runs, eq(versions.runId, runs.id))
        .where(eq(versions.projectId, projectId))
        .orderBy(asc(runs.startedAt), asc(versions.id));
      return rows.map(({ versions: version }) => mapVersion(version));
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
