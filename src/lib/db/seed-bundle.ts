import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { EXAMPLE_DURATION_LABEL } from "@/lib/agents/timing";
import * as schema from "./schema";
import { agentEvents, messages, projects, runs, versions } from "./schema";
import { SEED_EXAMPLE_PROJECTS } from "./seeds";
import { seedUuid } from "./seed-ids";

type AppDb =
  | BetterSQLite3Database<typeof schema>
  | DrizzleD1Database<typeof schema>;

type SeedProjectRow = typeof projects.$inferInsert;
type SeedRunRow = typeof runs.$inferInsert;
type SeedMessageRow = typeof messages.$inferInsert;
type SeedEventRow = typeof agentEvents.$inferInsert;
type SeedVersionRow = typeof versions.$inferInsert;

export type SeedBundle = {
  projects: SeedProjectRow[];
  runs: SeedRunRow[];
  messages: SeedMessageRow[];
  events: SeedEventRow[];
  versions: SeedVersionRow[];
};

const PRESET_TIMING = { durationLabel: EXAMPLE_DURATION_LABEL };

export function buildSeedBundle(deviceId: string, now = new Date()): SeedBundle {
  const projectRows: SeedProjectRow[] = [];
  const runRows: SeedRunRow[] = [];
  const messageRows: SeedMessageRow[] = [];
  const eventRows: SeedEventRow[] = [];
  const versionRows: SeedVersionRow[] = [];

  SEED_EXAMPLE_PROJECTS.forEach((example, index) => {
    if (example.qaReasons.length !== example.acceptance.length) {
      throw new Error(`Seed ${example.title} qaReasons must match acceptance`);
    }
    const slug = `example-${index}`;
    const projectId = seedUuid(deviceId, `${slug}:project`);
    const runId = seedUuid(deviceId, `${slug}:run`);
    const versionId = seedUuid(deviceId, `${slug}:version`);

    projectRows.push({
      id: projectId,
      deviceId,
      title: example.title,
      currentVersionId: versionId,
      shareSlug: null,
      createdAt: now,
      updatedAt: now,
    });
    runRows.push({
      id: runId,
      projectId,
      status: "completed",
      qaRounds: 0,
      qaScore: example.qaScore,
      tokensIn: 0,
      tokensOut: 0,
      startedAt: now,
      finishedAt: now,
    });
    messageRows.push(
      {
        id: seedUuid(deviceId, `${slug}:message:user`),
        projectId,
        role: "user",
        content: example.prd,
        createdAt: now,
      },
      {
        id: seedUuid(deviceId, `${slug}:message:agent`),
        projectId,
        role: "agent",
        content: example.summary,
        createdAt: now,
      },
    );
    eventRows.push(
      {
        id: seedUuid(deviceId, `${slug}:event:1`),
        runId,
        seq: 1,
        agent: "planner",
        type: "plan",
        payload: {
          title: example.title,
          prd: example.prd,
          acceptance: example.acceptance,
          timing: PRESET_TIMING,
          evidenceKind: "preset-example",
        },
      },
      {
        id: seedUuid(deviceId, `${slug}:event:2`),
        runId,
        seq: 2,
        agent: "architect",
        type: "design",
        payload: {
          ...example.design,
          timing: PRESET_TIMING,
          evidenceKind: "preset-example",
        },
      },
      {
        id: seedUuid(deviceId, `${slug}:event:3`),
        runId,
        seq: 3,
        agent: "engineer",
        type: "file",
        payload: {
          files: example.files,
          summary: example.summary,
          currentFiles: example.files,
          timing: PRESET_TIMING,
          evidenceKind: "preset-example",
        },
      },
      {
        id: seedUuid(deviceId, `${slug}:event:4`),
        runId,
        seq: 4,
        agent: "qa",
        type: "probe",
        payload: {
          round: 0,
          evidenceKind: "preset-example",
          timing: PRESET_TIMING,
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
      },
      {
        id: seedUuid(deviceId, `${slug}:event:5`),
        runId,
        seq: 5,
        agent: "qa",
        type: "verdict",
        payload: {
          round: 0,
          evidenceKind: "preset-example",
          timing: PRESET_TIMING,
          verdicts: example.acceptance.map((criterion, reasonIndex) => ({
            criterion,
            verdict: "pass" as const,
            reason: example.qaReasons[reasonIndex],
          })),
          qa_score: example.qaScore,
        },
      },
    );
    versionRows.push({
      id: versionId,
      projectId,
      runId,
      parentId: null,
      files: example.files,
      acceptance: example.acceptance,
      qaScore: example.qaScore,
      summary: example.summary,
    });
  });

  return {
    projects: projectRows,
    runs: runRows,
    messages: messageRows,
    events: eventRows,
    versions: versionRows,
  };
}

function statementsFor(
  executor: { insert: AppDb["insert"] },
  bundle: SeedBundle,
) {
  return [
    executor.insert(projects).values(bundle.projects).onConflictDoNothing(),
    executor.insert(runs).values(bundle.runs).onConflictDoNothing(),
    executor.insert(messages).values(bundle.messages).onConflictDoNothing(),
    executor.insert(agentEvents).values(bundle.events).onConflictDoNothing(),
    executor.insert(versions).values(bundle.versions).onConflictDoNothing(),
  ] as const;
}

/**
 * Insert both example projects in one SQLite transaction (local) or one D1
 * batch (production). Deterministic ids plus OR IGNORE make a racing second
 * caller a no-op instead of a second pair of projects.
 */
export async function persistSeedBundle(db: AppDb, deviceId: string): Promise<void> {
  const bundle = buildSeedBundle(deviceId);
  const d1 = db as DrizzleD1Database<typeof schema>;
  if (typeof d1.batch === "function") {
    await d1.batch(statementsFor(db, bundle));
    return;
  }

  const sqlite = db as BetterSQLite3Database<typeof schema>;
  sqlite.transaction((tx) => {
    for (const statement of statementsFor(tx, bundle)) {
      statement.run();
    }
  });
}
