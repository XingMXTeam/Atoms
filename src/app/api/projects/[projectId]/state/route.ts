import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEVICE_ID_COOKIE,
  getOrMintDeviceId,
  isSecureRequestUrl,
} from "@/lib/auth/device-id";
import {
  d1BookmarkSetCookie,
  decodeD1Bookmark,
  D1_BOOKMARK_COOKIE,
  getDb,
  readD1Bookmark,
} from "@/lib/db";
import { sanitizePreviewState } from "@/lib/preview/storage-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const putStateSchema = z.object({
  state: z.record(z.string(), z.string()),
});

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const secure = isSecureRequestUrl(request);
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
    { secure },
  );

  const bookmark = decodeD1Bookmark(cookieStore.get(D1_BOOKMARK_COOKIE)?.value);
  const repo = getDb({ d1Session: bookmark ?? "first-primary" });
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    const res = NextResponse.json({ messageZh: "项目不存在" }, { status: 404 });
    if (setCookie) res.headers.append("Set-Cookie", setCookie);
    return res;
  }

  const state = await repo.getProjectState(projectId);
  const res = NextResponse.json({ state });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

export async function PUT(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const secure = isSecureRequestUrl(request);
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  if (!existing) {
    return NextResponse.json({ messageZh: "请先打开自己的项目" }, { status: 401 });
  }
  const { deviceId, setCookie } = getOrMintDeviceId(
    `${DEVICE_ID_COOKIE}=${existing}`,
    { secure },
  );

  const bookmark = decodeD1Bookmark(cookieStore.get(D1_BOOKMARK_COOKIE)?.value);
  const repo = getDb({ d1Session: bookmark ?? "first-primary" });
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    const res = NextResponse.json({ messageZh: "无权修改此项目状态" }, { status: 403 });
    if (setCookie) res.headers.append("Set-Cookie", setCookie);
    return res;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ messageZh: "请求格式无效" }, { status: 400 });
  }

  const parsed = putStateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ messageZh: "状态格式无效" }, { status: 400 });
  }

  const sanitized = sanitizePreviewState(parsed.data.state);
  const saved = await repo.upsertProjectState(projectId, sanitized);
  const res = NextResponse.json({
    ok: true,
    state: saved,
    keyCount: Object.keys(saved).length,
  });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  const nextBookmark = readD1Bookmark(repo);
  if (nextBookmark) {
    res.headers.append("Set-Cookie", d1BookmarkSetCookie(nextBookmark, secure));
  }
  return res;
}
