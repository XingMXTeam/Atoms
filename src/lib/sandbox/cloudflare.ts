import { readCloudflareEnv } from "@/lib/cloudflare";
import {
  sandboxReviewReportSchema,
  type SandboxReviewPlan,
  type SandboxReviewReport,
} from "./review-types";
import type { SandboxCommandResult, SandboxFile, SandboxVerifyReport } from "./types";

const BRIDGE_TIMEOUT_MS = 20_000;
const REVIEW_BRIDGE_TIMEOUT_MS = 45_000;

type BridgeResponse = {
  ok?: boolean;
  commands?: SandboxCommandResult[];
  errors?: string[];
  durationMs?: number;
};

function readSandboxBridgeConfig(): { bridgeUrl: string; token?: string } | null {
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

  return {
    bridgeUrl: bridgeUrl.replace(/\/+$/, ""),
    ...(token?.trim() ? { token: token.trim() } : {}),
  };
}

/**
 * Production Cloudflare / Docker Sandbox adapter (`/verify`).
 * Connects to a deployed sandbox bridge (`SANDBOX_BRIDGE_URL`) backed by
 * Cloudflare Containers or a standalone Docker container (`Dockerfile.sandbox`).
 * Returns `null` when not configured so the runner falls back cleanly.
 */
export async function runCloudflareSandbox(
  files: SandboxFile[],
): Promise<SandboxVerifyReport | null> {
  const cfg = readSandboxBridgeConfig();
  if (!cfg) return null;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.bridgeUrl}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
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

/**
 * Production Sandbox Interactive Reviewer adapter (`/review`).
 * Executes real Playwright Chromium journeys + isolated Vitest boundary tests
 * inside the remote container and enforces SHA-256 artifact binding.
 */
export async function runCloudflareSandboxReview(
  files: SandboxFile[],
  plan: SandboxReviewPlan,
  expectedSha256: string,
): Promise<SandboxReviewReport | null> {
  const cfg = readSandboxBridgeConfig();
  if (!cfg) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVIEW_BRIDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.bridgeUrl}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: JSON.stringify({ files, plan, artifactSha256: expectedSha256 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const parsed = sandboxReviewReportSchema.safeParse(await res.json());
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
