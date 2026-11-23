import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
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
      { messageZh: "完成一次生成后即可创建分享链接" },
      { status: 409 },
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const shareSlug = await repo.ensureShareSlug(
        projectId,
        randomBytes(32).toString("base64url"),
      );
      if (!shareSlug) break;
      return NextResponse.json({ shareUrl: `/share/${shareSlug}` });
    } catch {
      // A collision is exceptionally unlikely; retry with a fresh opaque token.
    }
  }

  return NextResponse.json(
    { messageZh: "暂时无法创建分享链接，请重试" },
    { status: 500 },
  );
}
