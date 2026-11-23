import type { ProviderMode } from "@/lib/env";

export type { ProviderMode };

export type LlmCompletion = {
  text: string;
  meta: { mode: ProviderMode; label?: "演示回放" };
};

export interface LlmProvider {
  mode: ProviderMode;
  complete(input: unknown): Promise<LlmCompletion>;
}
