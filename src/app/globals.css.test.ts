import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css design-system + reduced-motion (REQ-1 / REQ-3)", () => {
  it("defines calm visual tokens including focus ring", () => {
    expect(css).toContain("--background");
    expect(css).toContain("--foreground");
    expect(css).toContain("--focus-ring");
    expect(css).toContain("--radius-card");
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("gates decorative motion behind prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("atoms-running-pulse");
    expect(css).toMatch(/animation:\s*none/);
    expect(css).toMatch(/transition(-[a-z]+)?:\s*none|transition:\s*none/);
  });

  it("exposes a shared focus-visible ring utility", () => {
    expect(css).toContain("atoms-focus-ring");
    expect(css).toContain(":focus-visible");
  });
});
