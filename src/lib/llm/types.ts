import type { ProviderMode } from "@/lib/env";

export type { ProviderMode };

export type TokenUsage = {
  tokensIn: number;
  tokensOut: number;
};

export type LlmCompletion = {
  text: string;
  meta: {
    mode: ProviderMode;
    label?: "演示回放";
    usage?: TokenUsage;
  };
};

export interface LlmProvider {
  mode: ProviderMode;
  complete(input: unknown): Promise<LlmCompletion>;
}
