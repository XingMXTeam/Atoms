import { readCloudflareEnv } from "@/lib/cloudflare";
import type { SandboxCommandResult, SandboxFile, SandboxVerifyReport } from "./types";

const BRIDGE_TIMEOUT_MS = 20_000;

type BridgeResponse = {
  ok?: boolean;
  commands?: SandboxCommandResult[];
  errors?: string[];
  durationMs?: number;
};

/**
 * Production Cloudflare Sandbox adapter.
 * Connects to a deployed Cloudflare Sandbox HTTP bridge (`SANDBOX_BRIDGE_URL`)
 * backed by `@cloudflare/sandbox` (Cloudflare Containers + Durable Objects).
 * Returns `null` when not configured so the runner falls back cleanly.
 */
export async function runCloudflareSandbox(
  files: SandboxFile[],
): Promise<SandboxVerifyReport | null> {
  const cfEnv = readCloudflareEnv();
  const bridgeUrl =
    (typeof cfEnv?.SANDBOX_BRIDGE_URL === "string"
      ? cfEnv.SANDBOX_BRIDGE_URL
      : undefined) ??
    (typeof process !== "undefined" ? process.env?.SANDBOX_BRIDGE_URL : undefined);

  if (!bridgeUrl?.trim()) return null;

  const token =
    (typeof cfEnv?.SANDBOX_BRIDGE_TOKEN === "string"
      ? cfEnv.SANDBOX_BRIDGE_TOKEN
      : undefined) ??
    (typeof process !== "undefined" ? process.env?.SANDBOX_BRIDGE_TOKEN : undefined);

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${bridgeUrl.replace(/\/+$/, "")}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
      },
      body: JSON.stringify({ files }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as BridgeResponse;
    const commands = Array.isArray(payload.commands) ? payload.commands : [];
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const ok = payload.ok === true && errors.length === 0;
    return {
      backend: "cloudflare-sandbox",
      isolated: true,
      ok,
      commands,
      errors,
      durationMs:
        typeof payload.durationMs === "number"
          ? payload.durationMs
          : Math.max(1, Date.now() - started),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
