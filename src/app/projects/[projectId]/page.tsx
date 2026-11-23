import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AgentTimeline } from "@/components/workbench/agent-timeline";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type WorkbenchPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ run?: string }>;
};

export default async function WorkbenchPage({
  params,
  searchParams,
}: WorkbenchPageProps) {
  const { projectId } = await params;
  const { run: runIdFromQuery } = await searchParams;
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value;

  if (!deviceId) {
    notFound();
  }

  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    notFound();
  }

  const run = runIdFromQuery ? await repo.getRun(runIdFromQuery) : null;
  if (runIdFromQuery && (!run || run.projectId !== projectId)) {
    notFound();
  }

  const runId = run?.id ?? runIdFromQuery ?? "";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">工作台</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.title}
          </h1>
          {runId ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {run?.status === "completed"
                ? "已完成"
                : run?.status === "interrupted"
                  ? "已中断"
                  : run?.status === "failed"
                    ? "失败"
                    : "运行中"}{" "}
              · {runId}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          返回首页
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {runId ? (
          <AgentTimeline
            projectId={projectId}
            initialRunId={runId}
            initialRunStatus={run?.status ?? "running"}
          />
        ) : (
          <aside className="min-h-64 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Agent 时间线
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              暂无运行记录。请从首页提交需求开始生成。
            </p>
          </aside>
        )}
        <section className="min-h-64 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            预览 · 代码
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            预览与代码面板将在后续任务接入。
          </p>
        </section>
      </div>
    </main>
  );
}
