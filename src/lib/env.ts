import { z } from "zod";

export const providerModeSchema = z.enum(["gemini", "mock", "replay"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

/** Defaults track currently available Flash/Pro-class Gemini ids (REQ-8). */
export const DEFAULT_GEMINI_MODEL_FLASH = "gemini-3.8-flash";
export const DEFAULT_GEMINI_MODEL_PRO = "gemini-3.1-pro-preview";

const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");
const ENV_KEYS = [
  "LLM_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL_FLASH",
  "GEMINI_MODEL_PRO",
  "DEVICE_DAILY_RUN_LIMIT",
  "DAILY_TOKEN_CAP",
] as const;

const envSchema = z.object({
  LLM_PROVIDER: providerModeSchema.default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL_FLASH: z.string().min(1).default(DEFAULT_GEMINI_MODEL_FLASH),
  GEMINI_MODEL_PRO: z.string().min(1).default(DEFAULT_GEMINI_MODEL_PRO),
  DEVICE_DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(20),
  DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(500_000),
});

export type AppEnv = z.infer<typeof envSchema>;

function readCloudflareEnv(): Record<string, unknown> | undefined {
  const ctx = (globalThis as Record<symbol, unknown>)[
    CLOUDFLARE_CONTEXT_SYMBOL
  ] as { env?: Record<string, unknown> } | undefined;
  return ctx?.env;
}

function buildDefaultEnvSource(): Record<string, string | undefined> {
  const cfEnv = readCloudflareEnv();
  const merged: Record<string, string | undefined> = {};

  for (const key of ENV_KEYS) {
    const cfValue = cfEnv?.[key];
    if (typeof cfValue === "string" && cfValue.length > 0) {
      merged[key] = cfValue;
    }
    const processValue =
      typeof process !== "undefined" ? process.env?.[key] : undefined;
    if (processValue !== undefined) {
      merged[key] = processValue;
    }
  }

  return merged;
}

/** Parse server env from Cloudflare bindings + process.env with `.env.example` defaults. */
export function getEnv(source?: Record<string, string | undefined>): AppEnv {
  const effective = source ?? buildDefaultEnvSource();
  return envSchema.parse({
    LLM_PROVIDER: effective.LLM_PROVIDER,
    GEMINI_API_KEY: effective.GEMINI_API_KEY,
    GEMINI_MODEL_FLASH: effective.GEMINI_MODEL_FLASH,
    GEMINI_MODEL_PRO: effective.GEMINI_MODEL_PRO,
    DEVICE_DAILY_RUN_LIMIT: effective.DEVICE_DAILY_RUN_LIMIT,
    DAILY_TOKEN_CAP: effective.DAILY_TOKEN_CAP,
  });
}
