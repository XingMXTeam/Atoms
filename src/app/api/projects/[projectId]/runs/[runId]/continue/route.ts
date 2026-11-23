import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { assertRateLimit, utcDay } from "@/lib/limits/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const followUpSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
});

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

/**
 * 「继续」 after an interrupted/failed run (REQ-9), or follow-up iteration (F5 REQ-2).
 * Known limitation: starts a fresh run for the same project — not an exact
 * checkpoint resume from the last agent_event.
 */
export async function POST(request: Request, context: RouteContext) {
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

  let followUpPrompt: string | undefined;
  const rawBody = await request.text();
  if (rawBody.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ messageZh: "请求格式无效，请重试" }, { status: 400 });
    }
    const parsed = followUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ messageZh: "请输入有效的后续需求" }, { status: 400 });
    }
    followUpPrompt = parsed.data.prompt;
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

  const day = utcDay();
  const decision = await assertRateLimit(deviceId, {
    getDeviceUsage: async (id, d) => {
      const row = await repo.getUsage(id, d);
      return row ? { runs: row.runs, tokens: row.tokens } : null;
    },
    getGlobalTokens: async () => 0,
  });

  if (!decision.ok && "refuse" in decision && decision.refuse) {
    const response = NextResponse.json(
      { messageZh: decision.messageZh },
      { status: 429 },
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
  if (followUpPrompt) {
    await repo.addMessage({ projectId, role: "user", content: followUpPrompt });
  }
  await repo.incrementUsage(deviceId, day, { runs: 1 });

  const payload = decision.ok
    ? { runId: nextRun.id, mode: decision.mode }
    : "mode" in decision
      ? {
          runId: nextRun.id,
          mode: decision.mode,
          label: decision.label,
        }
      : { runId: nextRun.id };

  const response = NextResponse.json(payload);
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
