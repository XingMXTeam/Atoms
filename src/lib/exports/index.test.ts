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
});
