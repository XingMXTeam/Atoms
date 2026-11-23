import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

/**
 * 「继续」 after an interrupted/failed run (REQ-9).
 * Known limitation: starts a fresh run for the same project — not an exact
 * checkpoint resume from the last agent_event.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { projectId, runId } = await context.params;
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
  );

  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    const response = NextResponse.json(
      { messageZh: "项目不存在" },
      { status: 404 },
    );
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  }

  const previous = await repo.getRun(runId);
  if (!previous || previous.projectId !== projectId) {
    const response = NextResponse.json(
      { messageZh: "运行不存在" },
      { status: 404 },
    );
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  }

  if (previous.status === "running") {
    await repo.updateRun(runId, {
      status: "interrupted",
      finishedAt: new Date(),
    });
  }

  const nextRun = await repo.createRun({
    projectId,
    status: "running",
  });

  const response = NextResponse.json({ runId: nextRun.id });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
