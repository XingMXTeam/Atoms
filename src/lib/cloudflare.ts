const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");

/** Read the OpenNext/Cloudflare request context `env` bindings if running on Workers. */
export function readCloudflareEnv(): Record<string, unknown> | undefined {
  const ctx = (globalThis as Record<symbol, unknown>)[
    CLOUDFLARE_CONTEXT_SYMBOL
  ] as { env?: Record<string, unknown> } | undefined;
  return ctx?.env;
}
