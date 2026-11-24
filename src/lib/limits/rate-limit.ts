import { getEnv, type ProviderMode } from "@/lib/env";
import { REPLAY_LABEL } from "@/lib/llm/modes/replay";

export type RateLimitDecision =
  | { ok: true; mode: ProviderMode }
  | { ok: false; mode: "replay"; label: "演示回放" }
  | { ok: false; refuse: true; messageZh: string };

export type DeviceUsageSnapshot = {
  runs: number;
  tokens: number;
};

export type AssertRateLimitDeps = {
  /** Preferred live mode when under caps (defaults to env LLM_PROVIDER). */
  preferredMode?: ProviderMode;
  deviceDailyRunLimit?: number;
  dailyTokenCap?: number;
  /** UTC calendar day `YYYY-MM-DD`; defaults to today. */
  day?: string;
  /** When false, over-cap path refuses in Chinese instead of replaying. */
  replayAvailable?: boolean;
  getDeviceUsage: (
    deviceId: string,
    day: string,
  ) => Promise<DeviceUsageSnapshot | null>;
  getGlobalTokens: (day: string) => Promise<number>;
};

const REFUSE_MESSAGE_ZH =
  "今日体验额度已用完，且演示回放暂不可用。请明天再试，或稍后再来。";

export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Daily run + global token gates (REQ-6).
 * Over-cap → degrade to replay + 「演示回放」; refuse in Chinese only when
 * replay cannot run.
 */
export async function assertRateLimit(
  deviceId: string,
  deps: AssertRateLimitDeps,
): Promise<RateLimitDecision> {
  const env = getEnv();
  const preferredMode = deps.preferredMode ?? env.LLM_PROVIDER;
  const deviceDailyRunLimit =
    deps.deviceDailyRunLimit ?? env.DEVICE_DAILY_RUN_LIMIT;
  const dailyTokenCap = deps.dailyTokenCap ?? env.DAILY_TOKEN_CAP;
  const day = deps.day ?? utcDay();
  const replayAvailable = deps.replayAvailable ?? true;

  const usage = await deps.getDeviceUsage(deviceId, day);
  const deviceRuns = usage?.runs ?? 0;
  const globalTokens = await deps.getGlobalTokens(day);

  const overRunCap = deviceRuns >= deviceDailyRunLimit;
  const overTokenCap = globalTokens >= dailyTokenCap;

  if (!overRunCap && !overTokenCap) {
    return { ok: true, mode: preferredMode };
  }

  if (!replayAvailable) {
    return { ok: false, refuse: true, messageZh: REFUSE_MESSAGE_ZH };
  }

  return { ok: false, mode: "replay", label: REPLAY_LABEL };
}
