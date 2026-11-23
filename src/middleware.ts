import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";

/**
 * Mint / refresh the anonymous `deviceId` cookie on every matched request.
 * Repository rows (projects / runs / usage) are scoped by this id (REQ-4).
 */
export function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const { deviceId, setCookie } = getOrMintDeviceId(cookieHeader);
  const requestHeaders = new Headers(request.headers);
  const preservedCookies = (cookieHeader ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.startsWith(`${DEVICE_ID_COOKIE}=`));
  preservedCookies.push(`${DEVICE_ID_COOKIE}=${deviceId}`);
  requestHeaders.set("cookie", preservedCookies.join("; "));

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on app routes; skip Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
