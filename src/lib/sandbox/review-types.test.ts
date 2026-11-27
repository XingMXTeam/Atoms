/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildFallbackReviewPlan,
  computeFilesSha256,
  validateVitestCodeSafety,
} from "./review-types";

describe("sandbox review protocol & safety", () => {
  it("computes deterministic order-independent SHA-256 and detects edits", async () => {
    const a = { path: "src/App.tsx", content: "export default () => <div>2048</div>;" };
    const b = { path: "./src/main.tsx", content: "import App from './App';" };

    const hash1 = await computeFilesSha256([a, b]);
    const hash2 = await computeFilesSha256([b, a]);
    const hash3 = await computeFilesSha256([{ ...a, content: a.content + " " }, b]);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
    expect(hash3).not.toBe(hash1);
  });

  it("blocks dangerous imports/APIs in dynamic Vitest code and allows safe tests", () => {
    const badSnippets = [
      `import fs from "node:fs";`,
      `import { exec } from "child_process";`,
      `console.log(process.env.GEMINI_API_KEY);`,
      `const x = eval("1+1");`,
      `fetch("https://evil.example.com");`,
      `import secret from "../../.env";`,
      `import axios from "axios";`,
    ];
    for (const code of badSnippets) {
      const result = validateVitestCodeSafety(code);
      expect(result.ok, `should reject: ${code}`).toBe(false);
    }

    const safeCode = `
      import { describe, expect, it } from "vitest";
      import { render, screen } from "@testing-library/react";
      import App from "../src/App";
      describe("boundary", () => {
        it("renders", () => {
          render(<App />);
          expect(screen.getByText("2048")).toBeTruthy();
        });
      });
    `;
    expect(validateVitestCodeSafety(safeCode)).toEqual({ ok: true });
  });

  it("builds deterministic fallback Playwright plans for keyboard, reset, and reload criteria", () => {
    const plan = buildFallbackReviewPlan(
      [
        "AC-1: 玩家可以通过键盘上下左右键控制网格内数字方块移动与合并",
        "AC-4: 提供重置按钮，点击后清空棋盘并重置分数为 0",
        "AC-5: 刷新页面后保留当前进度",
      ],
      {
        source: "atoms-preview",
        type: "probe",
        compileErrors: [],
        runtimeErrors: [],
        blankScreen: false,
        domSummary: { title: "2048", text: "2048 得分 0 重新开始", elementCount: 24 },
        interactionSummary: {
          interactiveCount: 1,
          buttonLabels: ["重新开始"],
          inputCount: 0,
        },
      },
    );

    expect(plan.cases).toHaveLength(3);
    expect(plan.cases[0]?.steps?.some((s) => s.type === "press" && s.key === "ArrowLeft")).toBe(true);
    expect(plan.cases[1]?.steps?.some((s) => s.type === "click" && s.text === "重新开始")).toBe(true);
    expect(plan.cases[2]?.steps?.some((s) => s.type === "reload")).toBe(true);
  });
});
