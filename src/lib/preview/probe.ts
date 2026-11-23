import { z } from "zod";

const reportText = z.string().max(500);

export const previewProbeReportSchema = z
  .object({
    source: z.literal("atoms-preview"),
    type: z.literal("probe"),
    compileErrors: z.array(reportText).max(20),
    runtimeErrors: z.array(reportText).max(20),
    blankScreen: z.boolean(),
    domSummary: z
      .object({
        title: z.string().max(200),
        text: z.string().max(2_000),
        elementCount: z.number().int().min(0).max(10_000),
      })
      .strict(),
  })
  .strict();

export type PreviewProbeReport = z.infer<typeof previewProbeReportSchema>;

export function createCompileErrorProbeReport(message: string): PreviewProbeReport {
  return previewProbeReportSchema.parse({
    source: "atoms-preview",
    type: "probe",
    compileErrors: [message.slice(0, 500)],
    runtimeErrors: [],
    blankScreen: true,
    domSummary: { title: "", text: "", elementCount: 0 },
  });
}

type PreviewProbeMessage = {
  source: unknown;
  data: unknown;
};

export function isPreviewProbeMessage(
  message: PreviewProbeMessage,
  activeFrame: unknown,
): PreviewProbeReport | null {
  if (!activeFrame || message.source !== activeFrame) return null;
  const result = previewProbeReportSchema.safeParse(message.data);
  return result.success ? result.data : null;
}
