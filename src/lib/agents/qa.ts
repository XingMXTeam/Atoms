import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type { PreviewProbeReport } from "@/lib/preview/probe";

export const qaVerdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        criterion: z.string().min(1),
        verdict: z.enum(["pass", "fail"]),
        reason: z.string().min(1),
      }),
    )
    .min(1),
    fixInstruction: z
      .string()
      .nullable()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : undefined;
      }),
});

export type QaVerdict = z.infer<typeof qaVerdictSchema>["verdicts"][number];

export type QaResult = {
  verdicts: QaVerdict[];
  qa_score: number;
  fixInstruction?: string;
};

export function aggregateQaScore(verdicts: QaVerdict[]): number {
  if (verdicts.length === 0) return 0;
  const passed = verdicts.filter(({ verdict }) => verdict === "pass").length;
  return Math.round((passed / verdicts.length) * 100);
}

export async function runQa(
  provider: LlmProvider,
  input: { acceptance: string[]; probe: PreviewProbeReport },
): Promise<QaResult> {
  const completion = await provider.complete({
    stage: "qa",
    modelClass: modelClassForStage("qa"),
    acceptance: input.acceptance,
    probe: input.probe,
    responseSchema: qaVerdictSchema,
  });
  const { verdicts, fixInstruction } = qaVerdictSchema.parse(
    JSON.parse(completion.text),
  );
  const actualCriteria = new Set(verdicts.map(({ criterion }) => criterion));
  if (
    actualCriteria.size !== verdicts.length ||
    actualCriteria.size !== input.acceptance.length ||
    input.acceptance.some((criterion) => !actualCriteria.has(criterion))
  ) {
    throw new Error("QA verdicts must cover each acceptance criterion exactly once");
  }

  return {
    verdicts,
    qa_score: aggregateQaScore(verdicts),
    ...(fixInstruction ? { fixInstruction } : {}),
  };
}
