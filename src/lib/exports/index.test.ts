import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createVersionZip } from "./index";

describe("createVersionZip", () => {
  it("creates an archive with every snapshot path and file content", async () => {
    const archive = await createVersionZip([
      { path: "src/App.tsx", content: "export default function App() {}" },
      { path: "package.json", content: "{\"name\":\"demo\"}" },
    ]);
    const zip = await JSZip.loadAsync(archive);

    expect(Object.keys(zip.files).sort()).toEqual(["package.json", "src/", "src/App.tsx"].sort());
    expect(await zip.file("src/App.tsx")?.async("string")).toBe(
      "export default function App() {}",
    );
    expect(await zip.file("package.json")?.async("string")).toBe(
      "{\"name\":\"demo\"}",
    );
  });

  it.each(["../secret.txt", "/root.txt", "C:/root.txt", "src\\..\\secret.txt", ""])(
    "rejects unsafe file path %s",
    async (path) => {
      await expect(createVersionZip([{ path, content: "unsafe" }])).rejects.toThrow();
    },
  );

  it("includes runnable Vite + React + Tailwind scaffold when includeScaffold is true", async () => {
    const archive = await createVersionZip(
      [
        { path: "src/main.tsx", content: 'import App from "./App";\n' },
        { path: "src/App.tsx", content: "export default function App() { return null; }" },
      ],
      { includeScaffold: true, title: "我的待办" },
    );
    const zip = await JSZip.loadAsync(archive);

    for (const required of [
      "package.json",
      "index.html",
      "vite.config.ts",
      "tsconfig.json",
      "src/index.css",
      "README.md",
    ]) {
      expect(zip.file(required)).not.toBeNull();
    }
    expect(await zip.file("index.html")?.async("string")).toContain("<title>我的待办</title>");
    expect(await zip.file("src/main.tsx")?.async("string")).toContain('import "./index.css";');
  });
});
