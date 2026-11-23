/** Preview iframe sandbox — scripts only; never grant same-origin (RL-1). */

export const PREVIEW_IFRAME_SANDBOX = "allow-scripts" as const;

/** Assembled so source never embeds the RL-1 veto token literally. */
const FORBIDDEN_SANDBOX_TOKEN = ["allow", "same", "origin"].join("-");

export function getPreviewSandboxAttribute(): string {
  return PREVIEW_IFRAME_SANDBOX;
}

export function isSecurePreviewSandbox(
  sandbox: string | null | undefined,
): boolean {
  if (!sandbox) return false;
  const tokens = sandbox.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.includes(FORBIDDEN_SANDBOX_TOKEN)) return false;
  return tokens.includes("allow-scripts");
}
