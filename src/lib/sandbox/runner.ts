import { runCloudflareSandbox, runCloudflareSandboxReview } from "./cloudflare";
import type {
  SandboxFile,
  SandboxReviewPlan,
  SandboxReviewReport,
  SandboxVerifyReport,
} from "./types";
import { runWorkerStaticVerifier } from "./worker-verifier";

export type {
  ReviewAction,
  ReviewCaseEvidence,
  ReviewCasePlan,
  ReviewStepTrace,
  ReviewStrategy,
  SandboxBackend,
  SandboxCommandResult,
  SandboxFile,
  SandboxReviewPlan,
  SandboxReviewReport,
  SandboxVerifyReport,
} from "./types";

function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

/**
 * Pluggable backend execution sandbox runner:
 * 1. Remote Sandbox container bridge (`SANDBOX_BRIDGE_URL` / Cloudflare Containers) when configured.
 * 2. Local Node isolated subprocess sandbox (`tsc --noEmit` in clean temp dir, stripped env).
 * 3. Worker static verifier (inside `workerd` when container bridge is not configured).
 */
export async function verifyInBackendSandbox(
  files: SandboxFile[],
): Promise<SandboxVerifyReport> {
  // Always validate static policy first (CDN ban, document.cookie ban, import allowlist).
  const staticCheck = runWorkerStaticVerifier(files);
  if (!staticCheck.ok) {
    return staticCheck;
  }

  // 1. Try remote Sandbox container bridge if configured.
  const cfReport = await runCloudflareSandbox(files);
  if (cfReport) {
    return cfReport;
  }

  // 2. Try isolated local Node subprocess (`tsc --noEmit`) when running on Node.
  if (!isWorkersRuntime()) {
    try {
      const { runLocalNodeSandbox } = await import("./local-node");
      const localReport = await runLocalNodeSandbox(files);
      if (localReport) {
        return localReport;
      }
    } catch {
      // Fall through to worker-static-verifier if subprocess execution is unavailable.
    }
  }

  // 3. Fallback: return verified static check cleanly.
  return staticCheck;
}

/**
 * Pluggable intelligent interactive reviewer runner (Plan B):
 * 1. Remote Sandbox container bridge (`SANDBOX_BRIDGE_URL/review`: Playwright + Vitest).
 * 2. Local Node isolated reviewer (`local-reviewer.ts`: Playwright Chromium + Vitest).
 * 3. Honest `null` fallback on Workers without a configured container bridge.
 */
export async function runInteractiveSandboxReview(
  files: SandboxFile[],
  plan: SandboxReviewPlan,
  expectedSha256: string,
): Promise<SandboxReviewReport | null> {
  const staticCheck = runWorkerStaticVerifier(files);
  if (!staticCheck.ok) {
    return null;
  }

  const cfReview = await runCloudflareSandboxReview(files, plan, expectedSha256);
  if (cfReview) {
    return cfReview;
  }

  if (!isWorkersRuntime()) {
    try {
      const { runLocalNodeReviewer } = await import("./local-reviewer");
      const localReview = await runLocalNodeReviewer(files, plan, expectedSha256);
      if (localReview) {
        return localReview;
      }
    } catch {
      // Fall through cleanly when local Playwright/Vitest cannot start.
    }
  }

  return null;
}
