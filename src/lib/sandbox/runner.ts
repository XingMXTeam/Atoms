import { runCloudflareSandbox } from "./cloudflare";
import type { SandboxFile, SandboxVerifyReport } from "./types";
import { runWorkerStaticVerifier } from "./worker-verifier";

export type {
  SandboxBackend,
  SandboxCommandResult,
  SandboxFile,
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
 * 1. Cloudflare Sandbox (`SANDBOX_BRIDGE_URL` / Cloudflare Containers) when configured.
 * 2. Local Node isolated subprocess sandbox (`tsc --noEmit` in clean temp dir, stripped env).
 * 3. Worker static verifier (inside `workerd` when Containers are not enabled).
 */
export async function verifyInBackendSandbox(
  files: SandboxFile[],
): Promise<SandboxVerifyReport> {
  // Always validate static policy first (CDN ban, document.cookie ban, import allowlist).
  const staticCheck = runWorkerStaticVerifier(files);
  if (!staticCheck.ok) {
    return staticCheck;
  }

  // 1. Try Cloudflare Sandbox container bridge if configured.
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
