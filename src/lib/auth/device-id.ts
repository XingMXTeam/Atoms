/** Anonymous device identity via HttpOnly cookie (REQ-4). */

export const DEVICE_ID_COOKIE = "deviceId";

/** ~1 year — long-lived anonymous identity. */
export const DEVICE_ID_MAX_AGE = 31_536_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeviceIdResult = {
  deviceId: string;
  setCookie?: string;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Read `deviceId` from a raw Cookie header value.
 * Returns null when absent or empty.
 */
export function parseDeviceIdCookie(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== DEVICE_ID_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    return value.length > 0 ? value : null;
  }

  return null;
}

function buildSetCookie(deviceId: string): string {
  return [
    `${DEVICE_ID_COOKIE}=${deviceId}`,
    "Path=/",
    `Max-Age=${DEVICE_ID_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");
}

/**
 * Stable read of the anonymous deviceId; mint a UUID when missing/invalid.
 * When minting, `setCookie` is the full Set-Cookie header value to send.
 */
export function getOrMintDeviceId(
  cookieHeader: string | null | undefined,
): DeviceIdResult {
  const existing = parseDeviceIdCookie(cookieHeader);
  if (existing && isUuid(existing)) {
    return { deviceId: existing };
  }

  const deviceId = crypto.randomUUID();
  return { deviceId, setCookie: buildSetCookie(deviceId) };
}
