import { NextResponse, type NextRequest } from "next/server";
import { getOrMintDeviceId } from "@/lib/auth/device-id";

/**
 * Mint / refresh the anonymous `deviceId` cookie on every matched request.
 * Repository rows (projects / runs / usage) are scoped by this id (REQ-4).
 */
export function middleware(request: NextRequest) {
  const { setCookie } = getOrMintDeviceId(request.headers.get("cookie"));
  const response = NextResponse.next();

  if (setCookie) {
    response.headers.append("Set-Cookie", setCookie);
  }

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
