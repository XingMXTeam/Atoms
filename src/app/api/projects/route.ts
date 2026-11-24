import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICE_ID_COOKIE, getOrMintDeviceId, isSecureRequestUrl } from "@/lib/auth/device-id";
import { d1BookmarkSetCookie, getDb, readD1Bookmark } from "@/lib/db";
import { assertRateLimit, utcDay } from "@/lib/limits/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().trim().min(1, "请输入需求后再开始生成"),
});

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= 32) return compact;
  return `${compact.slice(0, 32)}…`;
}

export async function POST(request: Request) {
  const secure = isSecureRequestUrl(request);
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
    { secure },
  );

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { messageZh: "请求格式无效，请重试" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { messageZh: "请输入需求后再开始生成" },
      { status: 400 },
    );
  }

  const repo = getDb({ d1Session: "first-primary" });
  const day = utcDay();

  const decision = await assertRateLimit(deviceId, {
    getDeviceUsage: async (id, d) => {
      const row = await repo.getUsage(id, d);
      return row ? { runs: row.runs, tokens: row.tokens } : null;
    },
    getGlobalTokens: (d) => repo.getGlobalTokens(d),
  });

  if (!decision.ok && "refuse" in decision && decision.refuse) {
    const response = NextResponse.json(
      { messageZh: decision.messageZh },
      { status: 429 },
    );
    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  }

  const prompt = parsed.data.prompt;
  const project = await repo.createProject({
    deviceId,
    title: titleFromPrompt(prompt),
  });
  const run = await repo.createRun({
    projectId: project.id,
    status: "running",
  });
  await repo.addMessage({
    projectId: project.id,
    role: "user",
    content: prompt,
  });
  await repo.incrementUsage(deviceId, day, { runs: 1 });

  const payload = decision.ok
    ? { projectId: project.id, runId: run.id, mode: decision.mode }
    : "mode" in decision
      ? {
          projectId: project.id,
          runId: run.id,
          mode: decision.mode,
          label: decision.label,
        }
      : { projectId: project.id, runId: run.id };

  const response = NextResponse.json(payload);
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  const bookmark = readD1Bookmark(repo);
  if (bookmark) {
    response.headers.append("Set-Cookie", d1BookmarkSetCookie(bookmark, secure));
  }
  return response;
}
