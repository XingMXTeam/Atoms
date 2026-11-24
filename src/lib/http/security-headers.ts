/**
 * Document CSP for this app:
 * - Next.js and the preview srcdoc use inline scripts, so script-src allows
 *   'unsafe-inline'.
 * - In-browser esbuild-wasm needs 'wasm-unsafe-eval' and may construct
 *   functions, so 'unsafe-eval' stays.
 * - The preview iframe is same-document srcdoc (frame-src 'self' blob:).
 * - frame-ancestors 'none' plus X-Frame-Options DENY stop clickjacking of
 *   the studio shell. The shell is the parent, not the framed preview.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

export type HeaderPair = { key: string; value: string };

export function securityHeaders(options: { hsts: boolean }): HeaderPair[] {
  const headers: HeaderPair[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  ];
  if (options.hsts) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}

export function applySecurityHeaders(
  headers: Headers,
  options: { hsts: boolean },
): void {
  for (const header of securityHeaders(options)) {
    headers.set(header.key, header.value);
  }
  headers.delete("x-powered-by");
  headers.delete("x-opennext");
}
