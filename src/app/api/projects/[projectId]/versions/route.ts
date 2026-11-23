import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { parseVersionFiles } from "@/lib/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const { deviceId, setCookie } = await getDeviceId();
  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) return jsonWithCookie({ messageZh: "项目不存在" }, 404, setCookie);

  const versions = await repo.listVersions(projectId);
  return jsonWithCookie(
    {
      versions: versions.map(({ id, summary, qaScore }) => ({
        id,
        summary: summary ?? "版本快照",
        qaScore,
      })),
      currentVersionId: project.currentVersionId,
    },
    200,
    setCookie,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const { deviceId, setCookie } = await getDeviceId();
  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) return jsonWithCookie({ messageZh: "项目不存在" }, 404, setCookie);

  let versionId: unknown;
  try {
    versionId = (await request.json() as { versionId?: unknown }).versionId;
  } catch {
    return jsonWithCookie({ messageZh: "版本请求无效，请重试" }, 400, setCookie);
  }
  if (typeof versionId !== "string" || versionId.length === 0) {
    return jsonWithCookie({ messageZh: "请选择要恢复的版本" }, 400, setCookie);
  }

  const version = await repo.getVersion(versionId);
  if (!version || version.projectId !== projectId) {
    return jsonWithCookie({ messageZh: "版本不存在" }, 404, setCookie);
  }

  await repo.setCurrentVersion(projectId, version.id);
  return jsonWithCookie(
    {
      versionId: version.id,
      qaScore: version.qaScore,
      files: parseVersionFiles(version.files),
    },
    200,
    setCookie,
  );
}

async function getDeviceId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  return getOrMintDeviceId(existing ? `${DEVICE_ID_COOKIE}=${existing}` : null);
}

function jsonWithCookie(body: unknown, status: number, setCookie?: string) {
  const response = NextResponse.json(body, { status });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
