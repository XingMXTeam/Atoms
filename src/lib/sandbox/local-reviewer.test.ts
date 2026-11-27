/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { runLocalNodeReviewer } from "./local-reviewer";
import {
  createDemo2048Files,
  DEMO_2048_REVIEW_PLAN,
} from "./review-fixtures";
import { computeFilesSha256 } from "./review-types";

describe("local sandbox intelligent reviewer (real Playwright Chromium + isolated Vitest)", () => {
  it("verifies all 4 React 2048 acceptance criteria with real browser screenshots and Vitest boundary proof", async () => {
    const files = createDemo2048Files();
    const expectedSha = await computeFilesSha256(files);

    const report = await runLocalNodeReviewer(files, DEMO_2048_REVIEW_PLAN, expectedSha);

    expect(report).not.toBeNull();
    expect(report!.backend).toBe("local-node-sandbox");
    expect(report!.isolated).toBe(true);
    expect(report!.artifactSha256).toBe(expectedSha);
    expect(report!.ok).toBe(true);
    expect(report!.cases).toHaveLength(4);

    for (const c of report!.cases) {
      expect(c.status, `${c.criterion}: ${c.summary}`).toBe("passed");
    }

    // Real Playwright screenshots captured for browser cases
    expect(report!.cases[0]?.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(report!.cases[1]?.steps.some((s) => s.action.includes("reload"))).toBe(true);
    expect(report!.cases[1]?.storageAfter).toHaveProperty("atoms-2048-state");

    // Real isolated Vitest boundary test executed for AC-3 Game Over
    expect(report!.cases[2]?.vitestCommand?.exitCode).toBe(0);
    expect(report!.cases[2]?.vitestCommand?.command).toContain("vitest run");
  }, 45_000);

  it("catches a broken reset button in real Playwright Chromium", async () => {
    const brokenFiles = createDemo2048Files({ brokenReset: true });
    const expectedSha = await computeFilesSha256(brokenFiles);

    const report = await runLocalNodeReviewer(
      brokenFiles,
      { cases: [DEMO_2048_REVIEW_PLAN.cases[3]!] },
      expectedSha,
    );

    expect(report).not.toBeNull();
    expect(report!.ok).toBe(false);
    expect(report!.cases[0]?.status).toBe("failed");
    expect(report!.cases[0]?.summary).toContain("当前得分：0");
    expect(report!.cases[0]?.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  }, 30_000);

  it("rejects execution when artifact SHA-256 does not match", async () => {
    const files = createDemo2048Files();
    const report = await runLocalNodeReviewer(
      files,
      { cases: [DEMO_2048_REVIEW_PLAN.cases[0]!] },
      "0".repeat(64),
    );

    expect(report).not.toBeNull();
    expect(report!.ok).toBe(false);
    expect(report!.cases[0]?.status).toBe("not_performed");
    expect(report!.errors[0]).toContain("SHA-256");
  });
});
