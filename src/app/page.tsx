import { cookies } from "next/headers";
import { PromptForm } from "@/components/home/prompt-form";
import { ProjectGrid } from "@/components/home/project-grid";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const repo = getDb();
  if (deviceId) await repo.ensureSeedProjects(deviceId);
  const projects = deviceId ? await repo.listProjects(deviceId) : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col items-center gap-12 overflow-x-clip px-4 py-16 sm:px-6">
      <div className="max-w-xl text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
          Atoms Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          可验证的 AI 应用生成
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          输入需求，Agent 团队会规划、设计并生成可预览的应用。
        </p>
      </div>

      <PromptForm />
      <ProjectGrid projects={projects} />
    </main>
  );
}
