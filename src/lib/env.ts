import { z } from "zod";

export const providerModeSchema = z.enum(["gemini", "mock", "replay"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

const envSchema = z.object({
  LLM_PROVIDER: providerModeSchema.default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
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
    DEVICE_DAILY_RUN_LIMIT: source.DEVICE_DAILY_RUN_LIMIT,
    DAILY_TOKEN_CAP: source.DAILY_TOKEN_CAP,
  });
}
