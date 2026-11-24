import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkbenchClient } from "@/components/workbench/workbench-client";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { D1_BOOKMARK_COOKIE, decodeD1Bookmark, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type WorkbenchPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ run?: string; provider?: string }>;
};

type CodeFile = { path: string; content: string };

function filesFromVersion(files: unknown): CodeFile[] {
  if (!Array.isArray(files)) return [];
  const next: CodeFile[] = [];
  for (const item of files) {
    if (!item || typeof item !== "object") continue;
    const path = (item as { path?: unknown }).path;
    const content = (item as { content?: unknown }).content;
    if (typeof path === "string" && typeof content === "string") {
      next.push({ path, content });
    }
  }
  return next;
}

export default async function WorkbenchPage({
  params,
  searchParams,
}: WorkbenchPageProps) {
  const { projectId } = await params;
  const { run: runIdFromQuery, provider: providerFromQuery } = await searchParams;
  const initialProviderLabel =
    providerFromQuery === "replay" ? "演示回放" : null;
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value;

  if (!deviceId) {
    notFound();
  }

  const bookmark = decodeD1Bookmark(cookieStore.get(D1_BOOKMARK_COOKIE)?.value);
  // Read the primary (or the seed bookmark) so a project that just became
  // visible is not served a stale replica 404.
  const repo = getDb({ d1Session: bookmark ?? "first-primary" });
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    notFound();
  }

  const currentVersion = project.currentVersionId
    ? await repo.getVersion(project.currentVersionId)
    : null;
  const version = currentVersion?.projectId === projectId ? currentVersion : null;
  const versions = await repo.listVersions(projectId);
  const initialProjectState = await repo.getProjectState(projectId);

  const preferredRunId = runIdFromQuery ?? version?.runId ?? null;
  const run = preferredRunId ? await repo.getRun(preferredRunId) : null;
  if (runIdFromQuery && (!run || run.projectId !== projectId)) {
    notFound();
  }
  if (run && run.projectId !== projectId) {
    notFound();
  }
  const runId = run?.id ?? "";

  let initialFiles: CodeFile[] = [];
  if (version && (!run || run.status === "completed")) {
    initialFiles = filesFromVersion(version.files);
  } else if (runId) {
    const events = await repo.listAgentEvents(runId);
    const engineerFile = [...events]
      .reverse()
      .find((e) => e.agent === "engineer" && e.type === "file");
    if (engineerFile) {
      initialFiles = filesFromVersion(
        (engineerFile.payload as { files?: unknown } | null)?.files,
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-6 overflow-x-clip px-4 py-10 sm:px-6">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">工作台</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.title}
          </h1>
          {runId ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {/* Label avoids the substring 「运行中」 (false-match on completed). */}
              编号 · {runId}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="atoms-focus-ring shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          返回首页
        </Link>
      </div>

      {runId ? (
        <WorkbenchClient
          projectId={projectId}
          initialRunId={runId}
          initialRunStatus={run?.status ?? "running"}
          initialRunQaRounds={run?.qaRounds ?? 0}
          initialRunQaScore={run?.qaScore ?? null}
          initialVersionId={version?.id ?? null}
          initialVersionRunId={version?.runId ?? null}
          initialVersionQaScore={version?.qaScore ?? null}
          initialFiles={initialFiles}
          initialProjectState={initialProjectState}
          initialQaScore={project.qaScore}
          initialProviderLabel={initialProviderLabel}
          initialVersions={versions.map((item) => ({
            id: item.id,
            summary: item.summary ?? "版本快照",
            qaScore: item.qaScore,
          }))}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <aside className="min-h-64 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Agent 时间线
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              暂无运行记录。请从首页提交需求开始生成。
            </p>
          </aside>
          <section className="min-h-64 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              预览 · 代码
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              提交需求后，这里会显示预览与代码。
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
