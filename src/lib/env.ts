import { z } from "zod";
import { readCloudflareEnv } from "./cloudflare";

export const providerModeSchema = z.enum(["gemini", "mock", "replay"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

/** Defaults track currently available cost-optimized Flash-class Gemini ids (REQ-8). */
export const DEFAULT_GEMINI_MODEL_FLASH = "gemini-3.1-flash-lite";
export const DEFAULT_GEMINI_MODEL_PRO = "gemini-3.8-flash";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const ENV_KEYS = [
  "LLM_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL_FLASH",
  "GEMINI_MODEL_PRO",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "DEVICE_DAILY_RUN_LIMIT",
  "DAILY_TOKEN_CAP",
  "PLATFORM_DEMO_GENERATIONS",
  "PLATFORM_DAILY_TOKEN_CAP",
  "PLATFORM_MONTHLY_TOKEN_CAP",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
] as const;

const envSchema = z.object({
  LLM_PROVIDER: providerModeSchema.default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL_FLASH: z.string().min(1).default(DEFAULT_GEMINI_MODEL_FLASH),
  GEMINI_MODEL_PRO: z.string().min(1).default(DEFAULT_GEMINI_MODEL_PRO),
  DEEPSEEK_API_KEY: z.string().optional().default(""),
  DEEPSEEK_MODEL: z.string().min(1).default(DEFAULT_DEEPSEEK_MODEL),
  DEEPSEEK_BASE_URL: z.string().min(1).default(DEFAULT_DEEPSEEK_BASE_URL),
  /**
   * Legacy per-device daily run counter. Platform demo no longer uses this
   * as a billing gate (see PLATFORM_DEMO_GENERATIONS). Kept so older deploys
   * still parse.
   */
  DEVICE_DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(20),
  /** Legacy global token counter. Platform billing uses PLATFORM_* caps. */
  DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(500_000),
  /** Lifetime platform-key generations per deviceId. Default is one demo. */
  PLATFORM_DEMO_GENERATIONS: z.coerce.number().int().positive().default(1),
  /** UTC-day cap on tokens paid by the platform Gemini/DeepSeek keys. */
  PLATFORM_DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(50_000),
  /** UTC-month cap on tokens paid by the platform keys. */
  PLATFORM_MONTHLY_TOKEN_CAP: z.coerce.number().int().positive().default(300_000),
  /** Public Turnstile site key. Empty disables the widget; demo then fails closed. */
  TURNSTILE_SITE_KEY: z.string().optional().default(""),
  /** Turnstile secret. Never commit a real value. Empty refuses platform demo. */
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
});

export type AppEnv = z.infer<typeof envSchema>;

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
    DEEPSEEK_API_KEY: effective.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: effective.DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL: effective.DEEPSEEK_BASE_URL,
    DEVICE_DAILY_RUN_LIMIT: effective.DEVICE_DAILY_RUN_LIMIT,
    DAILY_TOKEN_CAP: effective.DAILY_TOKEN_CAP,
    PLATFORM_DEMO_GENERATIONS: effective.PLATFORM_DEMO_GENERATIONS,
    PLATFORM_DAILY_TOKEN_CAP: effective.PLATFORM_DAILY_TOKEN_CAP,
    PLATFORM_MONTHLY_TOKEN_CAP: effective.PLATFORM_MONTHLY_TOKEN_CAP,
    TURNSTILE_SITE_KEY: effective.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: effective.TURNSTILE_SECRET_KEY,
  });
}
