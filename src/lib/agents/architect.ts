import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type { ArchitectPayload, GeneratedFile, PlannerPayload } from "./fixtures";

export const architectSchema = z.object({
  files: z.array(z.string().min(1)).min(1),
  components: z.array(z.string().min(1)).min(1),
  data: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export async function runArchitect(
  provider: LlmProvider,
  input: {
    prompt: string;
    plan: PlannerPayload;
    history?: Array<{ role: "user" | "agent"; content: string }>;
    currentFiles?: GeneratedFile[];
  },
): Promise<ArchitectPayload> {
  const completion = await provider.complete({
    prompt: input.prompt,
    stage: "architect",
    modelClass: modelClassForStage("architect"),
    plan: input.plan,
    ...(input.history ? { history: input.history } : {}),
    ...(input.currentFiles ? { currentFiles: input.currentFiles } : {}),
    responseSchema: architectSchema,
  });
  return architectSchema.parse(JSON.parse(completion.text));
}
