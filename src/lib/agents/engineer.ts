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

/** Return only changed files so the pipeline can merge a focused repair. */
export async function runEngineerRepair(
  provider: LlmProvider,
  input: {
    prompt: string;
    plan: PlannerPayload;
    design: ArchitectPayload;
    currentFiles: EngineerPayload["files"];
    fixInstruction: string;
  },
): Promise<EngineerPayload> {
  const completion = await provider.complete({
    prompt: input.prompt,
    stage: "engineer-repair",
    modelClass: modelClassForStage("engineer"),
    plan: input.plan,
    design: input.design,
    currentFiles: input.currentFiles,
    fixInstruction: input.fixInstruction,
    responseSchema: engineerSchema,
  });
  const repair = engineerSchema.parse(JSON.parse(completion.text));
  const existingFiles = new Map(
    input.currentFiles.map(({ path, content }) => [path, content]),
  );
  const deltaFiles = repair.files.filter(
    ({ path, content }) => existingFiles.get(path) !== content,
  );
  if (deltaFiles.length === 0) {
    throw new Error("Engineer repair did not change any files");
  }
  return { ...repair, files: deltaFiles };
}
