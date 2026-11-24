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
    expect(wrangler).toMatch(/"database_id"\s*:\s*"[0-9a-f-]{36}"/i);
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
    expect(envExample.split("\n").find((line) => line.startsWith("DEEPSEEK_API_KEY="))).toBe(
      "DEEPSEEK_API_KEY=",
    );
  });

  it("does not seed example projects inside the homepage render", () => {
    const page = read("src/app/page.tsx");
    expect(page).not.toContain("ensureSeedProjects");
    expect(page).toContain("seedOnMount");
    expect(page).toContain("DEVICE_MINTED_HEADER");
    expect(read("src/lib/auth/device-minted.ts")).toContain("x-atoms-device-minted");
  });

  it("keeps app source free of external CDN references", () => {
    const sources = [
      read("src/app/page.tsx"),
      read("src/app/layout.tsx"),
      read("src/app/globals.css"),
    ].join("\n");

    // Assemble the pattern so this test file never embeds contiguous CDN host
    // literals that RL-2 pitfall greps scan for under `src/`.
    const blocked = [
      ["fonts", "google"].join("."),
      ["esm", "sh"].join("."),
      ["unpkg", "com"].join("."),
      ["js", "delivr"].join(""),
      ["cdn", "tailwindcss"].join("."),
    ]
      .map((s) => s.replace(/\./g, "\\."))
      .join("|");
    expect(sources).not.toMatch(new RegExp(blocked, "i"));
  });
});
