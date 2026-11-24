import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type { GeneratedFile, PlannerPayload } from "./fixtures";

export const plannerSchema = z.object({
  title: z.string().min(1),
  prd: z.string().min(1),
  acceptance: z.array(z.string().min(1)).min(1),
});

export type PlannerInput =
  | string
  | {
      prompt: string;
      history?: Array<{ role: "user" | "agent"; content: string }>;
      currentFiles?: GeneratedFile[];
    };

export async function runPlanner(
  provider: LlmProvider,
  input: PlannerInput,
): Promise<PlannerPayload> {
  const normalized =
    typeof input === "string" ? { prompt: input } : input;
  const completion = await provider.complete({
    prompt: normalized.prompt,
    stage: "planner",
    modelClass: modelClassForStage("planner"),
    ...(normalized.history ? { history: normalized.history } : {}),
    ...(normalized.currentFiles ? { currentFiles: normalized.currentFiles } : {}),
    responseSchema: plannerSchema,
  });
  return plannerSchema.parse(JSON.parse(completion.text));
}
