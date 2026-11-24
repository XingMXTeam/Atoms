import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedProject } from "@/components/share/shared-project";
import { getDb } from "@/lib/db";
import { parseVersionFiles } from "@/lib/versions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SHARE_SLUG_RE = /^[A-Za-z0-9_-]{43}$/;

type SharePageProps = {
  params: Promise<{ shareSlug: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { shareSlug } = await params;
  if (!SHARE_SLUG_RE.test(shareSlug)) notFound();

  const repo = getDb();
  const project = await repo.getProjectByShareSlug(shareSlug);
  if (!project?.currentVersionId) notFound();

  const version = await repo.getVersion(project.currentVersionId);
  if (!version || version.projectId !== project.id) notFound();

  let files;
  try {
    files = parseVersionFiles(version.files);
  } catch {
    notFound();
  }

  return (
    <SharedProject
      title={project.title}
      summary={version.summary ?? "版本快照"}
      qaScore={version.qaScore}
      files={files}
    />
  );
}
