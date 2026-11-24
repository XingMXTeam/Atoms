import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { PromptForm } from "@/components/home/prompt-form";
import {
  ProjectSection,
} from "@/components/home/project-section";
import type { ProjectCardModel } from "@/components/home/project-grid";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { D1_BOOKMARK_COOKIE, decodeD1Bookmark, getDb } from "@/lib/db";
import { DEVICE_MINTED_HEADER } from "@/lib/auth/device-minted";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

function toCard(project: {
  id: string;
  title: string;
  qaScore: number | null;
  updatedAt: Date;
}): ProjectCardModel {
  return {
    id: project.id,
    title: project.title,
    qaScore: project.qaScore,
    updatedAt: project.updatedAt.toISOString(),
  };
}

export default async function Home() {
  const headerStore = await headers();
  const minted = headerStore.get(DEVICE_MINTED_HEADER) === "1";
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value;

  // A brand-new device used to block first paint on dozens of D1 writes.
  // Render the shell immediately and let the client seed after the cookie lands.
  let projects: ProjectCardModel[] = [];
  if (!minted && deviceId) {
    const bookmark = decodeD1Bookmark(cookieStore.get(D1_BOOKMARK_COOKIE)?.value);
    const repo = getDb({
      d1Session: bookmark ?? "first-unconstrained",
    });
    projects = (await repo.listProjects(deviceId)).map(toCard);
  }

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
      <ProjectSection
        initialProjects={projects}
        seedOnMount={minted || (Boolean(deviceId) && projects.length === 0)}
      />
    </main>
  );
}
