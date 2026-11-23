/** Preview iframe sandbox — never include allow-same-origin (RL-1). */

export const PREVIEW_IFRAME_SANDBOX = "allow-scripts" as const;

export function getPreviewSandboxAttribute(): string {
  return PREVIEW_IFRAME_SANDBOX;
}

export function isSecurePreviewSandbox(sandbox: string | null | undefined): boolean {
  if (!sandbox) return false;
  const tokens = sandbox.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.includes("allow-same-origin")) return false;
  return tokens.includes("allow-scripts");
}
