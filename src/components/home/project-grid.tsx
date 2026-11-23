import Link from "next/link";
import type { Project } from "@/lib/db/repository";

type ProjectGridProps = {
  projects: Project[];
};

export function ProjectGrid({ projects }: ProjectGridProps) {
  return (
    <section className="w-full max-w-2xl" aria-labelledby="my-projects-heading">
      <h2
        id="my-projects-heading"
        className="mb-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        我的项目
      </h2>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          还没有项目，输入需求开始生成吧
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100"
              >
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {project.title}
                </span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  {project.updatedAt.toLocaleString("zh-CN")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
