/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_MAX_AGE,
  getOrMintDeviceId,
  parseDeviceIdCookie,
} from "./device-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("getOrMintDeviceId", () => {
  it("mints a UUID and Set-Cookie when no deviceId cookie is present", () => {
    const result = getOrMintDeviceId(null);

    expect(result.deviceId).toMatch(UUID_RE);
    expect(result.setCookie).toBeDefined();

    const setCookie = result.setCookie!;
    expect(setCookie.startsWith(`${DEVICE_ID_COOKIE}=${result.deviceId}`)).toBe(
      true,
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain(`Max-Age=${DEVICE_ID_MAX_AGE}`);
  });

  it("mints when Cookie header has other cookies but no deviceId", () => {
    const result = getOrMintDeviceId("session=abc; theme=dark");

    expect(result.deviceId).toMatch(UUID_RE);
    expect(result.setCookie).toBeDefined();
  });

  it("reads an existing deviceId without Set-Cookie", () => {
    const existing = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
    const result = getOrMintDeviceId(`${DEVICE_ID_COOKIE}=${existing}; other=1`);

    expect(result.deviceId).toBe(existing);
    expect(result.setCookie).toBeUndefined();
  });

  it("is stable across repeated reads of the same Cookie header", () => {
    const existing = "11111111-2222-4333-8444-555555555555";
    const header = `${DEVICE_ID_COOKIE}=${existing}`;

    const first = getOrMintDeviceId(header);
    const second = getOrMintDeviceId(header);

    expect(first.deviceId).toBe(existing);
    expect(second.deviceId).toBe(existing);
    expect(first.setCookie).toBeUndefined();
    expect(second.setCookie).toBeUndefined();
  });

  it("sets Secure when the caller marks the request as HTTPS", () => {
    const result = getOrMintDeviceId(null, { secure: true });
    expect(result.setCookie).toContain("Secure");
    expect(result.setCookie).toMatch(/SameSite=Lax/i);
    expect(result.setCookie).toContain("HttpOnly");
  });

  it("omits Secure on non-HTTPS requests", () => {
    const result = getOrMintDeviceId(null, { secure: false });
    expect(result.setCookie).not.toContain("Secure");
  });

  it("re-mints when the deviceId cookie value is not a UUID", () => {
    const result = getOrMintDeviceId(`${DEVICE_ID_COOKIE}=not-a-uuid`);

    expect(result.deviceId).toMatch(UUID_RE);
    expect(result.deviceId).not.toBe("not-a-uuid");
    expect(result.setCookie).toBeDefined();
  });
});

describe("parseDeviceIdCookie", () => {
  it("returns null for missing or empty Cookie headers", () => {
    expect(parseDeviceIdCookie(null)).toBeNull();
    expect(parseDeviceIdCookie("")).toBeNull();
    expect(parseDeviceIdCookie("foo=bar")).toBeNull();
  });

  it("extracts the deviceId value from a Cookie header", () => {
    expect(
      parseDeviceIdCookie(`a=1; ${DEVICE_ID_COOKIE}=abc-123; b=2`),
    ).toBe("abc-123");
  });
});
