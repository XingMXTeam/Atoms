import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { createVersionZip } from "@/lib/exports";
import { parseVersionFiles } from "@/lib/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!PROJECT_ID_RE.test(projectId)) {
    return NextResponse.json({ messageZh: "项目不存在" }, { status: 404 });
  }

  const deviceId = (await cookies()).get(DEVICE_ID_COOKIE)?.value;
  if (!deviceId) {
    return NextResponse.json({ messageZh: "请先打开自己的项目" }, { status: 401 });
  }

  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    return NextResponse.json({ messageZh: "项目不存在" }, { status: 404 });
  }
  if (!project.currentVersionId) {
    return NextResponse.json(
      { messageZh: "完成一次生成后即可下载项目文件" },
      { status: 409 },
    );
  }

  const version = await repo.getVersion(project.currentVersionId);
  if (!version || version.projectId !== project.id) {
    return NextResponse.json({ messageZh: "当前版本不存在，请刷新后重试" }, { status: 404 });
  }

  try {
    const archive = await createVersionZip(parseVersionFiles(version.files));
    return new Response(Buffer.from(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.id}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { messageZh: "导出项目文件失败，请检查当前版本后重试" },
      { status: 500 },
    );
  }
}
