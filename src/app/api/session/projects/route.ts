import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotent example-project seed for a new device.
 * Kept off the homepage document so first paint does not wait on D1 writes.
 * GET stays unimplemented so `/api/projects` continues to answer GET with 405.
 */
export async function POST(request: Request) {
  const secure = isSecureRequestUrl(request);
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId, setCookie } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
    { secure },
  );

  const incomingBookmark = decodeD1Bookmark(
    cookieStore.get(D1_BOOKMARK_COOKIE)?.value,
  );
  const repo = getDb({
    d1Session: incomingBookmark ?? "first-primary",
  });
  await repo.ensureSeedProjects(deviceId);
  const projects = await repo.listProjects(deviceId);
  const response = NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      qaScore: project.qaScore,
      updatedAt: project.updatedAt.toISOString(),
    })),
  });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  const bookmark = readD1Bookmark(repo);
  if (bookmark) {
    response.headers.append("Set-Cookie", d1BookmarkSetCookie(bookmark, secure));
  }
  return response;
}
