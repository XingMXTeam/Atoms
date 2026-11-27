/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "@/lib/db/adapters/sqlite";
import type { LlmProvider } from "@/lib/llm/types";
import type { PreviewProbeReport } from "@/lib/preview/probe";
import {
  createDemo2048Files,
  DEMO_2048_REVIEW_PLAN,
} from "@/lib/sandbox/review-fixtures";
import { runLocalNodeReviewer } from "@/lib/sandbox/local-reviewer";
import { computeFilesSha256 } from "@/lib/sandbox/review-types";
import { runAgentPipeline } from "./pipeline";
import { adjudicateReviewReport } from "./reviewer";

const static2048Probe: PreviewProbeReport = {
  source: "atoms-preview",
  type: "probe",
  compileErrors: [],
  runtimeErrors: [],
  blankScreen: false,
  domSummary: {
    title: "2048 经典版",
    text: "2048 经典版 当前得分：0 重新开始 2 2",
    elementCount: 24,
  },
  interactionSummary: {
    interactiveCount: 1,
    buttonLabels: ["重新开始"],
    inputCount: 0,
  },
};

describe("pipeline intelligent reviewer + auto-repair closed loop (Plan B)", () => {
  it("runs real Playwright+Vitest reviewer on unverified 2048 criteria, catches broken reset, auto-repairs, and passes round 1", async () => {
    const repo = createSqliteRepository(":memory:");
    const project = await repo.createProject({ deviceId: "device-2048", title: "2048" });
    const run = await repo.createRun({ projectId: project.id, status: "running" });

    const acceptance = DEMO_2048_REVIEW_PLAN.cases.map((c) => c.criterion);
    const brokenFiles = createDemo2048Files({ brokenReset: true });
    const fixedFiles = createDemo2048Files({ brokenReset: false });
    let repairCount = 0;

    const provider: LlmProvider = {
      mode: "gemini",
      async complete(input: unknown) {
        const req = input as Record<string, unknown>;
        if (req.stage === "planner") {
          return {
            text: JSON.stringify({ title: "2048 经典版", prd: "可玩 2048", acceptance }),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "architect") {
          return {
            text: JSON.stringify({
              files: ["src/main.tsx", "src/game/engine.ts", "src/App.tsx"],
              components: ["App"],
              data: ["board", "score"],
              notes: "2048 架构",
            }),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "engineer") {
          return {
            text: JSON.stringify({ files: brokenFiles, summary: "初始 2048 实现" }),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "engineer-repair") {
          repairCount += 1;
          expect(String(req.fixInstruction ?? "")).toContain("AC-4");
          return {
            text: JSON.stringify({
              files: [fixedFiles[2]!],
              summary: "已修复重置按钮清零得分",
            }),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "qa") {
          // Simulates exact static-probe limitation from screenshot: all 4 ACs are unverified statically.
          return {
            text: JSON.stringify({
              verdicts: acceptance.map((criterion) => ({
                criterion,
                verdict: "unverified",
                reason: "静态探针无法模拟键盘与边界状态，交由智能复核",
              })),
            }),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "qa-review-plan") {
          return {
            text: JSON.stringify(DEMO_2048_REVIEW_PLAN),
            meta: { mode: "gemini" },
          };
        }
        if (req.stage === "qa-review-judge") {
          // Verify strict isolation: judge must NOT receive Engineer source files.
          expect(req.currentFiles).toBeUndefined();
          const report = req.reviewReport as {
            cases: Array<{ criterion: string; status: string; summary: string }>;
          };
          const verdicts = report.cases.map((c) => ({
            criterion: c.criterion,
            verdict: c.status === "passed" ? "pass" : c.status === "failed" ? "fail" : "unverified",
            reason: c.summary,
          }));
          const failed = verdicts.filter((v) => v.verdict === "fail");
          return {
            text: JSON.stringify({
              verdicts,
              ...(failed.length > 0
                ? { fixInstruction: failed.map((f) => `${f.criterion}：${f.reason}`).join("；") }
                : {}),
            }),
            meta: { mode: "gemini" },
          };
        }
        throw new Error(`Unexpected stage: ${String(req.stage)}`);
      },
    };

    const result = await runAgentPipeline({
      repo,
      provider,
      projectId: project.id,
      runId: run.id,
      prompt: "做一个 2048 小游戏",
      probePreview: async () => static2048Probe,
      reviewSandbox: (files, plan, sha) => runLocalNodeReviewer(files, plan, sha),
    });

    expect(repairCount).toBe(1);
    expect(result.qaRounds).toBe(1);
    expect(result.qaScore).toBe(100);
    expect(result.exhausted).toBe(false);

    const events = await repo.listAgentEvents(run.id);
    const reviewEvents = events.filter((e) => e.type === "review");
    const verdictEvents = events.filter((e) => e.type === "verdict");

    expect(reviewEvents).toHaveLength(2);
    expect(verdictEvents).toHaveLength(2);

    // Round 0 review caught AC-4 fail; Round 1 review passed all 4/4!
    const round0Verdict = verdictEvents[0]!.payload as {
      qa_score: number;
      verdicts: Array<{ criterion: string; verdict: string; verifiedBy?: string }>;
    };
    expect(round0Verdict.qa_score).toBe(75);
    expect(round0Verdict.verdicts[3]?.verdict).toBe("fail");
    expect(round0Verdict.verdicts[3]?.verifiedBy).toBe("playwright-review");

    const round1Verdict = verdictEvents[1]!.payload as {
      qa_score: number;
      verdicts: Array<{ criterion: string; verdict: string; verifiedBy?: string }>;
    };
    expect(round1Verdict.qa_score).toBe(100);
    expect(round1Verdict.verdicts.every((v) => v.verdict === "pass")).toBe(true);
    expect(round1Verdict.verdicts[2]?.verifiedBy).toBe("vitest-review");
  }, 60_000);

  it("refuses to merge tampered review evidence when SHA-256 mismatches", async () => {
    const files = createDemo2048Files();
    const realSha = await computeFilesSha256(files);
    const provider: LlmProvider = {
      mode: "mock",
      async complete() {
        throw new Error("should not call LLM on SHA mismatch");
      },
    };

    const result = await adjudicateReviewReport(provider, {
      unverifiedCriteria: ["AC-1"],
      expectedSha256: realSha,
      reviewReport: {
        backend: "cloudflare-sandbox",
        isolated: true,
        artifactSha256: "f".repeat(64),
        ok: true,
        cases: [
          {
            criterion: "AC-1",
            strategy: "playwright",
            status: "passed",
            summary: "pass",
            steps: [],
            consoleErrors: [],
            pageErrors: [],
            durationMs: 100,
          },
        ],
        commands: [],
        errors: [],
        durationMs: 100,
      },
    });

    expect(result.verdicts).toEqual([
      {
        criterion: "AC-1",
        verdict: "unverified",
        reason: expect.stringContaining("SHA-256"),
      },
    ]);
  });
});
