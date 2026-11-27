import { z } from "zod";
import type { LlmProvider } from "@/lib/llm/types";
import { modelClassForStage } from "@/lib/llm/model-routing";
import type { PreviewProbeReport } from "@/lib/preview/probe";

export const qaVerifiedBySchema = z.enum([
  "static-probe",
  "playwright-review",
  "vitest-review",
  "hybrid-review",
]);

export type QaVerifiedBy = z.infer<typeof qaVerifiedBySchema>;

export const qaVerdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        criterion: z.string().min(1),
        verdict: z.enum(["pass", "fail", "unverified"]),
        reason: z.string().min(1),
        verifiedBy: qaVerifiedBySchema.optional(),
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

export type QaCoverage = {
  verified: number;
  unverified: number;
  total: number;
};

export type QaResult = {
  verdicts: QaVerdict[];
  qa_score: number;
  coverage?: QaCoverage;
  fixInstruction?: string;
};

export function computeQaCoverage(verdicts: QaVerdict[]): QaCoverage {
  const unverified = verdicts.filter(({ verdict }) => verdict === "unverified").length;
  return {
    verified: verdicts.length - unverified,
    unverified,
    total: verdicts.length,
  };
}

/**
 * Score verifiable criteria (`pass` / `fail`). When zero criteria have been
 * verified (all `unverified`), returns 0 rather than a misleading 100%.
 */
export function aggregateQaScore(verdicts: QaVerdict[]): number {
  if (verdicts.length === 0) return 0;
  const verifiable = verdicts.filter(({ verdict }) => verdict !== "unverified");
  if (verifiable.length === 0) return 0;
  const passed = verifiable.filter(({ verdict }) => verdict === "pass").length;
  return Math.round((passed / verifiable.length) * 100);
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

  const coverage = computeQaCoverage(verdicts);
  return {
    verdicts,
    qa_score: aggregateQaScore(verdicts),
    ...(coverage.unverified > 0 ? { coverage } : {}),
    ...(fixInstruction ? { fixInstruction } : {}),
  };
}
