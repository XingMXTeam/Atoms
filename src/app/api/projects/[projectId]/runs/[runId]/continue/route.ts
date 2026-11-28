import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_ID_COOKIE, getOrMintDeviceId, isSecureRequestUrl } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { parseByokHeaders } from "@/lib/llm/byok";
import { beginContinuation } from "@/lib/runs/access";
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
 * 「继续」 after an interrupted/failed run, or a follow-up iteration.
 * Platform keys are never used here. Production follow-ups require BYOK.
 * Known limitation: starts a fresh run — not an exact checkpoint resume.
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId, runId } = await context.params;
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
    { secure: isSecureRequestUrl(request) },
  );

  const withCookie = (response: NextResponse) => {
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  };

  let followUpPrompt: string | undefined;
  const rawBody = await request.text();
  if (rawBody.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return withCookie(
        NextResponse.json({ messageZh: "请求格式无效，请重试" }, { status: 400 }),
      );
    }
    const parsed = followUpSchema.safeParse(body);
    if (!parsed.success) {
      return withCookie(
        NextResponse.json({ messageZh: "请输入有效的后续需求" }, { status: 400 }),
      );
    }
    followUpPrompt = parsed.data.prompt;
  }

  const result = await beginContinuation({
    repo: getDb(),
    deviceId,
    projectId,
    runId,
    ...(followUpPrompt ? { prompt: followUpPrompt } : {}),
    env: getEnv(),
    byok: parseByokHeaders(request.headers),
  });

  if (!result.ok) {
    return withCookie(
      NextResponse.json(
        {
          code: result.code,
          messageZh: result.messageZh,
          replayAvailable: result.replayAvailable,
        },
        { status: result.status },
      ),
    );
  }

  return withCookie(
    NextResponse.json({
      runId: result.runId,
      mode: result.mode,
      billing: result.billing,
      ...(result.label ? { label: result.label } : {}),
    }),
  );
}
