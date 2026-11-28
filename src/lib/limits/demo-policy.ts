import type { ProviderMode } from "@/lib/env";
import { REPLAY_LABEL } from "@/lib/llm/modes/replay";
import type { RunBilling } from "@/lib/db/repository";

export type DemoDenialCode =
  | "demo_exhausted"
  | "platform_budget"
  | "turnstile_required"
  | "byok_required"
  | "byok_invalid";

export type DemoDecision =
  | {
      ok: true;
      billing: RunBilling;
      mode: ProviderMode;
      label?: typeof REPLAY_LABEL;
    }
  | {
      ok: false;
      status: number;
      code: DemoDenialCode;
      messageZh: string;
      replayAvailable: boolean;
    };

export const DEMO_EXHAUSTED_MESSAGE_ZH =
  "免费演示已用完：每位访客只能使用平台模型完整生成 1 次，继续修改必须使用你自己的 API Key。请粘贴 Gemini 或 OpenAI 兼容接口的密钥，或改用演示回放。重置 Cookie 不能可靠绕过此限制。";

export const PLATFORM_BUDGET_MESSAGE_ZH =
  "平台演示的全站额度已用完，本次不会调用平台模型。请粘贴你自己的 API Key，或改用演示回放。";

export const BYOK_REQUIRED_MESSAGE_ZH =
  "继续生成和后续修改不能使用平台模型。请填写你自己的 Gemini API Key，或 OpenAI 兼容接口的 Base URL、API Key 和模型名。";

export const TURNSTILE_REQUIRED_MESSAGE_ZH =
  "请先完成人机验证，再使用平台演示。你也可以改为粘贴自己的 API Key。";

export type PlatformAccessInput = {
  kind: "initial" | "continue";
  providerMode: ProviderMode;
  hasByok: boolean;
  useReplay: boolean;
  deviceGenerations: number;
  demoGenerationLimit: number;
  platformTokensToday: number;
  platformDailyCap: number;
  platformTokensMonth: number;
  platformMonthlyCap: number;
  /** Ignored unless the request would otherwise spend platform keys. */
  turnstileOk: boolean;
};

/**
 * Platform demo vs BYOK vs local mock/replay.
 * Platform keys are used for at most one initial generation per device,
 * and never for continue / follow-up. BYOK does not consult these caps.
 */
export function decidePlatformAccess(input: PlatformAccessInput): DemoDecision {
  if (input.hasByok) {
    return { ok: true, billing: "byok", mode: "gemini" };
  }

  if (input.providerMode === "mock") {
    return { ok: true, billing: "mock", mode: "mock" };
  }

  if (input.providerMode === "replay") {
    return { ok: true, billing: "replay", mode: "replay", label: REPLAY_LABEL };
  }

  if (input.kind === "continue") {
    return {
      ok: false,
      status: 402,
      code: "byok_required",
      messageZh: BYOK_REQUIRED_MESSAGE_ZH,
      replayAvailable: false,
    };
  }

  if (input.useReplay) {
    return { ok: true, billing: "replay", mode: "replay", label: REPLAY_LABEL };
  }

  if (input.deviceGenerations >= input.demoGenerationLimit) {
    return {
      ok: false,
      status: 402,
      code: "demo_exhausted",
      messageZh: DEMO_EXHAUSTED_MESSAGE_ZH,
      replayAvailable: true,
    };
  }

  if (
    input.platformTokensToday >= input.platformDailyCap ||
    input.platformTokensMonth >= input.platformMonthlyCap
  ) {
    return {
      ok: false,
      status: 402,
      code: "platform_budget",
      messageZh: PLATFORM_BUDGET_MESSAGE_ZH,
      replayAvailable: true,
    };
  }

  if (!input.turnstileOk) {
    return {
      ok: false,
      status: 403,
      code: "turnstile_required",
      messageZh: TURNSTILE_REQUIRED_MESSAGE_ZH,
      replayAvailable: false,
    };
  }

  return { ok: true, billing: "platform", mode: "gemini" };
}
