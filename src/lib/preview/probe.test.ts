import { describe, expect, it } from "vitest";
import {
  createCompileErrorProbeReport,
  isPreviewProbeMessage,
  previewProbeReportSchema,
} from "./probe";

const validReport = {
  source: "atoms-preview",
  type: "probe",
  compileErrors: [],
  runtimeErrors: ["TypeError: broken"],
  blankScreen: false,
  domSummary: {
    title: "Preview",
    text: "Rendered content",
    elementCount: 4,
  },
};

describe("preview probe report validation", () => {
  it("reports bounded compile failures before an iframe can load", () => {
    expect(createCompileErrorProbeReport("x".repeat(700)).compileErrors).toEqual([
      "x".repeat(500),
    ]);
  });

  it("accepts a bounded report from the active iframe only", () => {
    expect(
      isPreviewProbeMessage(
        { source: "active-iframe", data: validReport },
        "active-iframe",
      ),
    ).toEqual(validReport);
  });

  it("rejects messages from another source and malformed payloads", () => {
    expect(
      isPreviewProbeMessage(
        { source: "other-iframe", data: validReport },
        "active-iframe",
      ),
    ).toBeNull();
    expect(
      isPreviewProbeMessage(
        { source: "active-iframe", data: { ...validReport, type: "painted" } },
        "active-iframe",
      ),
    ).toBeNull();
    expect(
      isPreviewProbeMessage(
        { source: "active-iframe", data: { ...validReport, extra: "unbounded" } },
        "active-iframe",
      ),
    ).toBeNull();
  });

  it("caps report arrays and DOM text", () => {
    expect(
      previewProbeReportSchema.safeParse({
        ...validReport,
        runtimeErrors: Array.from({ length: 21 }, () => "error"),
      }).success,
    ).toBe(false);
    expect(
      previewProbeReportSchema.safeParse({
        ...validReport,
        domSummary: { ...validReport.domSummary, text: "x".repeat(2_001) },
      }).success,
    ).toBe(false);
  });
});
