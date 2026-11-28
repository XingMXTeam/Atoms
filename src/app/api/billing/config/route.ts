import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public billing hints. Never includes secrets or platform API keys. */
export async function GET() {
  const env = getEnv();
  return NextResponse.json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    demoGenerationLimit: env.PLATFORM_DEMO_GENERATIONS,
    platformDailyTokenCap: env.PLATFORM_DAILY_TOKEN_CAP,
    platformMonthlyTokenCap: env.PLATFORM_MONTHLY_TOKEN_CAP,
  });
}
