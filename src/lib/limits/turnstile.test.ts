/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  it("fails closed without calling siteverify when the secret is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyTurnstile({
      token: "token",
      secret: "",
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.messageZh).toMatch(/不会|拒绝|自己的 API Key/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts a token only when siteverify returns success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const ok = await verifyTurnstile({
      token: "turnstile-token",
      secret: "secret",
      remoteIp: "203.0.113.5",
      fetchImpl,
    });
    expect(ok.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(String(init?.body)).toContain("secret=secret");
    expect(String(init?.body)).toContain("response=turnstile-token");

    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    const rejected = await verifyTurnstile({
      token: "turnstile-token",
      secret: "secret",
      fetchImpl,
    });
    expect(rejected.ok).toBe(false);
  });
});
