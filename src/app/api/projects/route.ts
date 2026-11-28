import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICE_ID_COOKIE, getOrMintDeviceId, isSecureRequestUrl } from "@/lib/auth/device-id";
import { d1BookmarkSetCookie, getDb, readD1Bookmark } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { TURNSTILE_TOKEN_HEADER, parseByokHeaders } from "@/lib/llm/byok";
import { beginInitialRun } from "@/lib/runs/access";

export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().trim().min(1, "请输入需求后再开始生成"),
  useReplay: z.boolean().optional(),
});

export async function POST(request: Request) {
  const secure = isSecureRequestUrl(request);
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
    { secure },
  );

  const withCookie = (response: NextResponse) => {
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  };

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return withCookie(
      NextResponse.json({ messageZh: "请求格式无效，请重试" }, { status: 400 }),
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return withCookie(
      NextResponse.json({ messageZh: "请输入需求后再开始生成" }, { status: 400 }),
    );
  }

  const repo = getDb({ d1Session: "first-primary" });
  const result = await beginInitialRun({
    repo,
    deviceId,
    prompt: parsed.data.prompt,
    env: getEnv(),
    byok: parseByokHeaders(request.headers),
    useReplay: parsed.data.useReplay,
    turnstileToken: request.headers.get(TURNSTILE_TOKEN_HEADER),
    remoteIp: request.headers.get("cf-connecting-ip"),
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

  const payload = {
    projectId: result.projectId,
    runId: result.runId,
    mode: result.mode,
    billing: result.billing,
    ...(result.label ? { label: result.label } : {}),
  };
  const response = NextResponse.json(payload);
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  const bookmark = readD1Bookmark(repo);
  if (bookmark) {
    response.headers.append("Set-Cookie", d1BookmarkSetCookie(bookmark, secure));
  }
  return response;
}
