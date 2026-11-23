import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("foundation lock (REQ-1 / REQ-2 / REQ-7)", () => {
  it("locks the Chinese home title and H1", () => {
    const layout = read("src/app/layout.tsx");
    const page = read("src/app/page.tsx");

    expect(layout).toContain('lang="zh-CN"');
    expect(layout).toContain("Atoms Studio — 可验证的 AI 应用生成");
    expect(page).toContain("Atoms Studio");
    expect(page).toContain("可验证的 AI 应用生成");
  });

  it("locks OpenNext / Workers deploy config", () => {
    const nextConfig = read("next.config.ts");
    const openNext = read("open-next.config.ts");
    const wrangler = read("wrangler.jsonc");

    expect(nextConfig).toContain("initOpenNextCloudflareForDev");
    expect(openNext).toContain("defineCloudflareConfig");
    expect(wrangler).toMatch(/"name"\s*:\s*"atoms-demo"/);
    expect(wrangler).toContain("aws:us-east-1");
    expect(wrangler).toContain("atoms.maoxunxing.com");
    expect(wrangler).toMatch(/"binding"\s*:\s*"DB"/);
    expect(wrangler).toMatch(/Placeholder/i);
  });

  it("documents required env vars without committing secrets", () => {
    const envExample = read(".env.example");

    for (const key of [
      "GEMINI_API_KEY",
      "LLM_PROVIDER",
      "DAILY_TOKEN_CAP",
      "DEVICE_DAILY_RUN_LIMIT",
    ]) {
      expect(envExample).toContain(key);
    }

    expect(envExample).not.toMatch(/GEMINI_API_KEY\s*=\s*[^\s#]+/);
  });

  it("keeps app source free of external CDN references", () => {
    const sources = [
      read("src/app/page.tsx"),
      read("src/app/layout.tsx"),
      read("src/app/globals.css"),
    ].join("\n");

    expect(sources).not.toMatch(
      /fonts\.google|esm\.sh|unpkg\.com|jsdelivr|cdn\.tailwindcss/i,
    );
  });
});
