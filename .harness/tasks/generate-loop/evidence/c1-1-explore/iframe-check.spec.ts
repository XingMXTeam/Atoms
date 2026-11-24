import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const outDir = path.resolve(".harness/tasks/generate-loop/evidence/c1-1-explore");

test("iframe visual + header status", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /示例：/ }).first().click();
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/projects\//);
  const timeline = page.getByTestId("agent-timeline");
  await expect(timeline).toHaveAttribute("data-run-status", "completed", { timeout: 60000 });
  await page.getByTestId("workbench-tab-preview").click();
  const iframe = page.getByTestId("preview-iframe");
  await expect(iframe).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => ((await iframe.getAttribute("srcdoc")) || "").includes("我的待办") || ((await iframe.getAttribute("srcdoc")) || "").includes("mock-app")).toBe(true);

  // Give paint time
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "workbench-preview-late.png"), fullPage: false });

  const box = await iframe.boundingBox();
  const headerStatus = await page.locator("header").innerText().catch(async () => page.locator("main").locator("p, span").first().innerText());
  // Try reading painted pixels in iframe box via screenshot clip
  if (box) {
    await page.screenshot({
      path: path.join(outDir, "preview-iframe-clip.png"),
      clip: { x: box.x, y: box.y, width: Math.min(box.width, 800), height: Math.min(box.height, 600) },
    });
  }

  // opaque origin: contentDocument inaccessible; infer visual non-blank via PNG size and non-uniform pixels
  const clipPath = path.join(outDir, "preview-iframe-clip.png");
  const bytes = fs.statSync(clipPath).size;

  const pageChrome = {
    headerText: await page.locator("body").innerText().then((t) => t.split("\n").slice(0, 8)),
    runAttr: await timeline.getAttribute("data-run-status"),
    runLabel: await timeline.locator("..").innerText().catch(() => ""),
  };

  // Check if top status still says 运行中 while completed
  const runningLabelCount = await page.getByText("运行中").count();
  const completedLabelCount = await page.getByText("已完成").count();

  const info = { bytes, box, runningLabelCount, completedLabelCount, pageChrome };
  fs.writeFileSync(path.join(outDir, "iframe-check.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 2));
});
