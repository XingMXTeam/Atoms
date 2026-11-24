/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  CONTENT_SECURITY_POLICY,
  applySecurityHeaders,
  securityHeaders,
} from "./security-headers";

describe("security headers", () => {
  it("sets the studio CSP, frame denial, and baseline headers", () => {
    const headers = new Headers();
    headers.set("x-powered-by", "Next.js");
    headers.set("x-opennext", "1");
    applySecurityHeaders(headers, { hsts: false });

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("'wasm-unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("'unsafe-inline'");
    expect(headers.get("Strict-Transport-Security")).toBeNull();
    expect(headers.get("x-powered-by")).toBeNull();
    expect(headers.get("x-opennext")).toBeNull();
  });

  it("adds HSTS only when the request is HTTPS", () => {
    const httpsHeaders = securityHeaders({ hsts: true });
    const hsts = httpsHeaders.find((header) => header.key === "Strict-Transport-Security");
    expect(hsts?.value).toContain("max-age=31536000");
    expect(securityHeaders({ hsts: false }).some((header) => header.key === "Strict-Transport-Security")).toBe(false);
  });
});
