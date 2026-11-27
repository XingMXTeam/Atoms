/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { MOCK_ENGINEER_FILES } from "@/lib/agents/fixtures";
import { verifyInBackendSandbox } from "./runner";
import { runWorkerStaticVerifier } from "./worker-verifier";

describe("backend execution sandbox", () => {
  it("runs real isolated tsc --noEmit on valid React TSX files and exits 0", async () => {
    const report = await verifyInBackendSandbox(MOCK_ENGINEER_FILES);
    expect(report.backend).toBe("local-node-sandbox");
    expect(report.isolated).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.commands[0]?.command).toContain("tsc --noEmit");
    expect(report.commands[0]?.exitCode).toBe(0);
    expect(report.commands[1]?.command).toContain("bundle --format=iife --preview");
    expect(report.commands[1]?.exitCode).toBe(0);
  }, 20_000);

  it("catches preview bundle failures (e.g. missing CSS import) server-side in /verify", async () => {
    const brokenBundleFiles = [
      {
        path: "src/main.tsx",
        content: 'import { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<App />);',
      },
      {
        path: "src/App.tsx",
        content: 'import "./does-not-exist.css";\nexport default function App() { return <div>Hi</div>; }',
      },
    ];
    const report = await verifyInBackendSandbox(brokenBundleFiles);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("does-not-exist.css") || e.includes("找不到模块"))).toBe(true);
  }, 20_000);

  it("catches real TypeScript compile errors in isolated subprocess sandbox", async () => {
    const brokenFiles = [
      {
        path: "src/main.tsx",
        content: 'import { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<App />);',
      },
      {
        path: "src/App.tsx",
        content: 'export default function App() { const n: number = "not-a-number"; return <div>{n}</div>; }',
      },
    ];
    const report = await verifyInBackendSandbox(brokenFiles);
    expect(report.backend).toBe("local-node-sandbox");
    expect(report.ok).toBe(false);
    expect(report.commands[0]?.exitCode).not.toBe(0);
    expect(report.errors.some((e) => e.includes("TS2322"))).toBe(true);
  }, 20_000);

  it("blocks forbidden external CDN URLs and unallowlisted packages in static verifier", () => {
    const report = runWorkerStaticVerifier([
      {
        path: "src/App.tsx",
        content: 'import axios from "axios"; export default function App() { return <script src="https://esm.sh/react" />; }',
      },
    ]);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("CDN"))).toBe(true);
    expect(report.errors.some((e) => e.includes("axios"))).toBe(true);
  });

  it("allows @import \"tailwindcss\" inside CSS files in static verifier", () => {
    const report = runWorkerStaticVerifier([
      {
        path: "src/main.tsx",
        content: 'import App from "./App"; export { App };',
      },
      {
        path: "src/styles.css",
        content: '@import "tailwindcss";\n.tile { border-radius: 8px; }',
      },
      {
        path: "src/App.tsx",
        content: 'import "./styles.css"; export default function App() { return <div className="tile">OK</div>; }',
      },
    ]);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });
});
