import { z } from "zod";

export const providerModeSchema = z.enum(["gemini", "mock", "replay"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

/** Defaults track currently available Flash/Pro-class Gemini ids (REQ-8). */
export const DEFAULT_GEMINI_MODEL_FLASH = "gemini-2.0-flash";
export const DEFAULT_GEMINI_MODEL_PRO = "gemini-2.0-pro";

const envSchema = z.object({
  LLM_PROVIDER: providerModeSchema.default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL_FLASH: z.string().min(1).default(DEFAULT_GEMINI_MODEL_FLASH),
  GEMINI_MODEL_PRO: z.string().min(1).default(DEFAULT_GEMINI_MODEL_PRO),
  DEVICE_DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(20),
  DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(500_000),
});

export type AppEnv = z.infer<typeof envSchema>;

/** Parse server env with defaults matching `.env.example`. */
export function getEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  return envSchema.parse({
    LLM_PROVIDER: source.LLM_PROVIDER,
    GEMINI_API_KEY: source.GEMINI_API_KEY,
    GEMINI_MODEL_FLASH: source.GEMINI_MODEL_FLASH,
    GEMINI_MODEL_PRO: source.GEMINI_MODEL_PRO,
    DEVICE_DAILY_RUN_LIMIT: source.DEVICE_DAILY_RUN_LIMIT,
    DAILY_TOKEN_CAP: source.DAILY_TOKEN_CAP,
  });
}
