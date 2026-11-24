import { describe, expect, it } from "vitest";
import {
  createMockProvider,
  MOCK_PERSISTENT_FAILURE_TRIGGER,
} from "./mock";

describe("mock repair journey controls", () => {
  it("keeps a mount entry when exercising persistent repair failure", async () => {
    const provider = createMockProvider();
    const prompt = `${MOCK_PERSISTENT_FAILURE_TRIGGER}: 做一个中文待办清单`;
    const initial = await provider.complete({ stage: "engineer", prompt });
    const initialFiles = JSON.parse(initial.text) as {
      files: Array<{ path: string; content: string }>;
    };

    expect(initialFiles.files.map(({ path }) => path)).toContain("src/main.tsx");
    expect(initialFiles.files.find(({ path }) => path === "src/main.tsx")?.content)
      .toContain('createRoot(document.getElementById("root")!).render(<App />)');

    for (let round = 1; round <= 3; round += 1) {
      const repair = await provider.complete({ stage: "engineer-repair", prompt });
      const repairFiles = JSON.parse(repair.text) as {
        files: Array<{ path: string; content: string }>;
      };
      expect(repairFiles.files.map(({ path }) => path)).toEqual(["src/App.tsx"]);
      expect(repairFiles.files[0]?.content).toContain("MOCK_COMPILE_ERROR");
      expect(repairFiles.files[0]?.content).toContain(`持续失败修复 ${round}`);
    }
  });
});
