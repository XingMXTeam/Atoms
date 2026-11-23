import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type {
  ArchitectPayload,
  EngineerPayload,
  PlannerPayload,
} from "./fixtures";

export const engineerSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
    )
    .min(1),
  summary: z.string().min(1),
});

async function completeEngineer(
  provider: LlmProvider,
  input: {
    prompt: string;
    plan: PlannerPayload;
    design: ArchitectPayload;
  },
): Promise<EngineerPayload> {
  const completion = await provider.complete({
    prompt: input.prompt,
    stage: "engineer",
    modelClass: modelClassForStage("engineer"),
    plan: input.plan,
    design: input.design,
    responseSchema: engineerSchema,
  });
  return engineerSchema.parse(JSON.parse(completion.text));
}

/** Structured Engineer output with one automatic parse retry (REQ-8). */
export async function runEngineer(
  provider: LlmProvider,
  input: {
    prompt: string;
    plan: PlannerPayload;
    design: ArchitectPayload;
  },
): Promise<EngineerPayload> {
  try {
    return await completeEngineer(provider, input);
  } catch {
    return await completeEngineer(provider, input);
  }
}
