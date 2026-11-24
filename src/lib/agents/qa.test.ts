/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "@/lib/llm/types";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import { aggregateQaScore, runQa } from "./qa";

const healthyProbe: PreviewProbeReport = {
  source: "atoms-preview",
  type: "probe",
  compileErrors: [],
  runtimeErrors: [],
  blankScreen: false,
  domSummary: { title: "我的待办", text: "添加待办", elementCount: 8 },
};

describe("structured QA verdicts", () => {
  it("aggregates integer score from criterion verdicts", () => {
    expect(
      aggregateQaScore([
        { criterion: "页面显示标题", verdict: "pass", reason: "标题存在" },
        { criterion: "可以新增事项", verdict: "fail", reason: "未找到输入框" },
        { criterion: "支持完成事项", verdict: "pass", reason: "存在复选框" },
      ]),
    ).toBe(67);
    expect(aggregateQaScore([])).toBe(0);
  });

  it("sends acceptance criteria and probe to Flash QA and returns structured verdicts", async () => {
    let request: Record<string, unknown> | undefined;
    const provider: LlmProvider = {
      mode: "mock",
      async complete(input) {
        request = input as Record<string, unknown>;
        return {
          text: JSON.stringify({
            verdicts: [
              { criterion: "页面显示标题", verdict: "pass", reason: "标题可见" },
              { criterion: "可以新增事项", verdict: "fail", reason: "没有表单" },
            ],
          }),
          meta: { mode: "mock" },
        };
      },
    };

    const result = await runQa(provider, {
      acceptance: ["页面显示标题", "可以新增事项"],
      probe: healthyProbe,
    });

    expect(request).toMatchObject({
      stage: "qa",
      modelClass: "flash",
      acceptance: ["页面显示标题", "可以新增事项"],
      probe: healthyProbe,
    });
    expect(result).toEqual({
      verdicts: [
        { criterion: "页面显示标题", verdict: "pass", reason: "标题可见" },
        { criterion: "可以新增事项", verdict: "fail", reason: "没有表单" },
      ],
      qa_score: 50,
    });
  });

  it("rejects verdicts that do not cover each acceptance criterion exactly once", async () => {
    const provider: LlmProvider = {
      mode: "mock",
      async complete() {
        return {
          text: JSON.stringify({
            verdicts: [
              { criterion: "页面显示标题", verdict: "pass", reason: "标题可见" },
            ],
          }),
          meta: { mode: "mock" },
        };
      },
    };

    await expect(
      runQa(provider, {
        acceptance: ["页面显示标题", "可以新增事项"],
        probe: healthyProbe,
      }),
    ).rejects.toThrow();
  });

  it("accepts empty or null fixInstruction when all criteria pass and omits it from QaResult", async () => {
    for (const emptyValue of ["", "   ", null]) {
      const provider: LlmProvider = {
        mode: "mock",
        async complete() {
          return {
            text: JSON.stringify({
              verdicts: [
                { criterion: "页面显示标题", verdict: "pass", reason: "标题可见" },
              ],
              fixInstruction: emptyValue,
            }),
            meta: { mode: "mock" },
          };
        },
      };

      const result = await runQa(provider, {
        acceptance: ["页面显示标题"],
        probe: healthyProbe,
      });

      expect(result).toEqual({
        verdicts: [
          { criterion: "页面显示标题", verdict: "pass", reason: "标题可见" },
        ],
        qa_score: 100,
      });
      expect("fixInstruction" in result).toBe(false);
    }
  });

  it("scores only verifiable criteria when unverified verdicts are present and reports coverage", async () => {
    const provider: LlmProvider = {
      mode: "mock",
      async complete() {
        return {
          text: JSON.stringify({
            verdicts: [
              { criterion: "AC-1 展示 25:00", verdict: "pass", reason: "标题与 25:00 均已渲染" },
              { criterion: "AC-2 25 分钟结束后响铃", verdict: "unverified", reason: "静态探针无法等待 25 分钟归零，需人工复核" },
            ],
          }),
          meta: { mode: "mock" },
        };
      },
    };

    const result = await runQa(provider, {
      acceptance: ["AC-1 展示 25:00", "AC-2 25 分钟结束后响铃"],
      probe: healthyProbe,
    });

    expect(result.qa_score).toBe(100);
    expect(result.coverage).toEqual({ verified: 1, unverified: 1, total: 2 });
  });
});
