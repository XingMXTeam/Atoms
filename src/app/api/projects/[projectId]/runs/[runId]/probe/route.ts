import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICE_ID_COOKIE } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { previewProbeReportSchema } from "@/lib/preview/probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  round: z.number().int().min(0).max(5),
  report: previewProbeReportSchema,
});

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId, runId } = await context.params;
  const deviceId = (await cookies()).get(DEVICE_ID_COOKIE)?.value;
  if (!deviceId) {
    return NextResponse.json({ messageZh: "请先打开自己的项目" }, { status: 401 });
  }

  const repo = getDb();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    return NextResponse.json({ messageZh: "项目不存在" }, { status: 404 });
  }

  const run = await repo.getRun(runId);
  if (!run || run.projectId !== projectId) {
    return NextResponse.json({ messageZh: "运行不存在" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ messageZh: "探测报告格式无效" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ messageZh: "探测报告字段无效" }, { status: 400 });
  }

  await repo.savePreviewProbe({
    runId,
    round: parsed.data.round,
    report: parsed.data.report,
  });

  return NextResponse.json({ ok: true });
}
