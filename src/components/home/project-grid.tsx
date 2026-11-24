import Link from "next/link";
import { formatShanghaiDateTime } from "@/lib/time/shanghai";

export type ProjectCardModel = {
  id: string;
  title: string;
  qaScore: number | null;
  updatedAt: string;
};

type ProjectGridProps = {
  projects: ProjectCardModel[];
};

export function ProjectGrid({ projects }: ProjectGridProps) {
  return (
    <section className="w-full max-w-2xl min-w-0" aria-labelledby="my-projects-heading">
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
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id} className="min-w-0">
              <Link
                href={`/projects/${project.id}`}
                data-testid="project-card"
                className="atoms-focus-ring atoms-card-lift block min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 px-4 py-3.5 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/95 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/90"
              >
                <span
                  data-testid="project-card-title"
                  className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  title={project.title}
                >
                  {project.title}
                </span>
                <span className="mt-1 block truncate text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatShanghaiDateTime(project.updatedAt)}
                </span>
                {project.qaScore !== null ? (
                  <span
                    data-testid="project-score-badge"
                    className={
                      project.qaScore >= 90
                        ? "mt-2.5 inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60"
                        : "mt-2.5 inline-flex max-w-full truncate rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    }
                  >
                    {project.qaScore} 分
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
