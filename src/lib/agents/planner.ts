import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type { PlannerPayload } from "./fixtures";

export const plannerSchema = z.object({
  title: z.string().min(1),
  prd: z.string().min(1),
  acceptance: z.array(z.string().min(1)).min(1),
});

export async function runPlanner(
  provider: LlmProvider,
  prompt: string,
): Promise<PlannerPayload> {
  const completion = await provider.complete({
    prompt,
    stage: "planner",
    modelClass: modelClassForStage("planner"),
    responseSchema: plannerSchema,
  });
  return plannerSchema.parse(JSON.parse(completion.text));
}
