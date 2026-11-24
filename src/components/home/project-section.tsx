"use client";

import { useEffect, useState } from "react";
import { ProjectGrid, type ProjectCardModel } from "./project-grid";

type ProjectSectionProps = {
  initialProjects: ProjectCardModel[];
  /** New device: fetch seeds after first paint instead of blocking HTML. */
  seedOnMount: boolean;
};

export function ProjectSection({
  initialProjects,
  seedOnMount,
}: ProjectSectionProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [phase, setPhase] = useState<"ready" | "loading" | "error">(
    seedOnMount && initialProjects.length === 0 ? "loading" : "ready",
  );

  useEffect(() => {
    if (!seedOnMount || initialProjects.length > 0) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/session/projects", {
          method: "POST",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("seed failed");
        const data = (await response.json()) as { projects?: ProjectCardModel[] };
        if (!Array.isArray(data.projects)) throw new Error("seed payload");
        setProjects(data.projects);
        setPhase("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setPhase("error");
      }
    })();
    return () => controller.abort();
  }, [initialProjects.length, seedOnMount]);

  if (phase === "loading") {
    return (
      <section className="w-full max-w-2xl min-w-0" aria-labelledby="my-projects-heading">
        <h2
          id="my-projects-heading"
          className="mb-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          我的项目
        </h2>
        <p
          role="status"
          className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          正在准备示例项目…
        </p>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="w-full max-w-2xl min-w-0" aria-labelledby="my-projects-heading">
        <h2
          id="my-projects-heading"
          className="mb-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          我的项目
        </h2>
        <p
          role="alert"
          className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          示例项目加载失败，请刷新页面重试
        </p>
      </section>
    );
  }

  return <ProjectGrid projects={projects} />;
}
