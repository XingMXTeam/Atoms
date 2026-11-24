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
] as const;

const envSchema = z.object({
  LLM_PROVIDER: providerModeSchema.default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL_FLASH: z.string().min(1).default(DEFAULT_GEMINI_MODEL_FLASH),
  GEMINI_MODEL_PRO: z.string().min(1).default(DEFAULT_GEMINI_MODEL_PRO),
  DEEPSEEK_API_KEY: z.string().optional().default(""),
  DEEPSEEK_MODEL: z.string().min(1).default(DEFAULT_DEEPSEEK_MODEL),
  DEEPSEEK_BASE_URL: z.string().min(1).default(DEFAULT_DEEPSEEK_BASE_URL),
  DEVICE_DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(20),
  DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(500_000),
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
  });
}
