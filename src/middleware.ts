import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_ID_COOKIE,
  getOrMintDeviceId,
  isSecureRequest,
} from "@/lib/auth/device-id";
import { DEVICE_MINTED_HEADER } from "@/lib/auth/device-minted";
import { applySecurityHeaders } from "@/lib/http/security-headers";

/**
 * Mint / refresh the anonymous `deviceId` cookie on every matched request.
 * Repository rows (projects / runs / usage) are scoped by this id (REQ-4).
 */
export function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const secure = isSecureRequest({
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  const { deviceId, setCookie } = getOrMintDeviceId(cookieHeader, { secure });
  const requestHeaders = new Headers(request.headers);
  const preservedCookies = (cookieHeader ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.startsWith(`${DEVICE_ID_COOKIE}=`));
  preservedCookies.push(`${DEVICE_ID_COOKIE}=${deviceId}`);
  requestHeaders.set("cookie", preservedCookies.join("; "));
  if (setCookie) requestHeaders.set(DEVICE_MINTED_HEADER, "1");
  else requestHeaders.delete(DEVICE_MINTED_HEADER);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  applySecurityHeaders(response.headers, { hsts: secure });
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
