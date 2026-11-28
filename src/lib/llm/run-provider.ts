import type { ByokCredentials, ParsedByok } from "./byok";
import type { RunBilling } from "@/lib/db/repository";

export type StreamProviderChoice =
  | { ok: true; kind: "byok"; credentials: ByokCredentials; billTo: "visitor" }
  | { ok: true; kind: "platform"; billTo: "platform" }
  | { ok: true; kind: "mock" | "replay"; billTo: "visitor" }
  | { ok: false; status: number; messageZh: string };

/**
 * Pick the model caller for an already-created run.
 * A BYOK run never falls back to platform keys. A platform run never
 * borrows a visitor key. Over budget, the platform run degrades to replay
 * without calling Gemini or DeepSeek.
 */
export function selectStreamProvider(input: {
  billing: RunBilling | string;
  byok: ParsedByok;
  overPlatformBudget: boolean;
}): StreamProviderChoice {
  if (input.byok.attempted && !input.byok.credentials) {
    return {
      ok: false,
      status: 400,
      messageZh: input.byok.errorZh,
    };
  }

  if (input.billing === "byok") {
    if (!input.byok.credentials) {
      return {
        ok: false,
        status: 401,
        messageZh:
          "这次运行需要你的 API Key，但请求里没有带上。请重新填写密钥后再试。平台密钥不会被用作备用。",
      };
    }
    return {
      ok: true,
      kind: "byok",
      credentials: input.byok.credentials,
      billTo: "visitor",
    };
  }

  if (input.billing === "platform") {
    if (input.overPlatformBudget) {
      return { ok: true, kind: "replay", billTo: "visitor" };
    }
    return { ok: true, kind: "platform", billTo: "platform" };
  }

  if (input.billing === "replay") {
    return { ok: true, kind: "replay", billTo: "visitor" };
  }

  return { ok: true, kind: "mock", billTo: "visitor" };
}
