/** @vitest-environment node */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPromptForStage } from "@/lib/llm/modes/gemini";
import { buildPreviewSrcdoc } from "@/lib/preview/bundle";
import { PREVIEW_IFRAME_SANDBOX, isSecurePreviewSandbox } from "@/lib/preview/sandbox";

const root = resolve(process.cwd());

describe("production reliability guardrails", () => {
  it("keeps preview sandbox and engineer prompt storage/form contracts aligned", () => {
    const tokens = PREVIEW_IFRAME_SANDBOX.split(/\s+/);
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-forms");
    expect(isSecurePreviewSandbox(PREVIEW_IFRAME_SANDBOX)).toBe(true);

    const engineerPrompt = buildPromptForStage({
      stage: "engineer",
      prompt: "做一个待办清单",
    }).systemInstruction;
    const repairPrompt = buildPromptForStage({
      stage: "engineer-repair",
      prompt: "修复",
    }).systemInstruction;

    for (const instruction of [engineerPrompt, repairPrompt]) {
      expect(instruction).toContain("localStorage");
      expect(instruction).toMatch(/严禁.*document\.cookie/);
      expect(instruction).toMatch(/preventDefault|onClick/);
      expect(instruction).toContain("*.test.tsx");
    }

    const qaPrompt = buildPromptForStage({
      stage: "qa",
      acceptance: ["AC-1"],
    }).systemInstruction;
    expect(qaPrompt).toContain(".test.tsx");
    expect(qaPrompt).toContain("vitest");

    const srcdoc = buildPreviewSrcdoc("console.log(1)", "", "", "", {
      demo: "1",
    });
    expect(srcdoc).toContain('type: "storage"');
    expect(srcdoc).toContain('Object.defineProperty(window, "localStorage"');
  });

  it("enforces layered preview Tailwind CSS and deduplicated minified vendor assets", () => {
    const css = readFileSync(resolve(root, "public/preview/tailwind.css"), "utf8");
    expect(css).toContain("@layer theme, base, components, utilities;");
    expect(css).toContain("@layer base {");

    for (const legacyFile of ["react.js", "jsx-runtime.js", "react-dom-client.js"]) {
      expect(existsSync(resolve(root, "public/preview/vendor", legacyFile))).toBe(false);
    }

    const runtimePath = resolve(root, "public/preview/vendor/runtime.js");
    expect(existsSync(runtimePath)).toBe(true);
    expect(statSync(runtimePath).size).toBeLessThan(350_000);
  });

  it("reads SQLite schema directly from migrations/0000_init.sql without inline DDL drift", () => {
    const sqliteAdapter = readFileSync(
      resolve(root, "src/lib/db/adapters/sqlite.ts"),
      "utf8",
    );
    expect(sqliteAdapter).toContain("0000_init.sql");
    expect(sqliteAdapter).not.toContain("CREATE TABLE");
  });
});
