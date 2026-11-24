#!/usr/bin/env node
/**
 * Rebuild same-origin preview vendor assets under public/preview/.
 * No CDN — China reachability (REQ-6 / RL-2).
 *
 * Emits a classic IIFE that installs one React instance on
 * `globalThis.__ATOMS_PREVIEW_VENDOR__`. The in-browser esbuild pass
 * treats React specifiers as shims over that global so the app never
 * embeds a second copy (invalid-hook-call / blank paint).
 */
import {
  cpSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const outDir = join(root, "public/preview");
const vendorDir = join(outDir, "vendor");
const entriesDir = join(root, "scripts/preview-vendor-entries");

mkdirSync(vendorDir, { recursive: true });

const wasmSrc = require.resolve("esbuild-wasm/esbuild.wasm");
cpSync(wasmSrc, join(outDir, "esbuild.wasm"));

function findEsbuildPackage() {
  const candidates = [
    join(root, "node_modules/esbuild/package.json"),
    join(root, "node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/package.json"),
  ];
  try {
    const { readdirSync } = require("node:fs");
    const pnpm = join(root, "node_modules/.pnpm");
    for (const name of readdirSync(pnpm)) {
      if (!name.startsWith("esbuild@")) continue;
      candidates.push(
        join(pnpm, name, "node_modules/esbuild/package.json"),
      );
    }
  } catch {
    // ignore
  }
  for (const pkg of candidates) {
    if (existsSync(pkg)) return dirname(pkg);
  }
  throw new Error("Cannot locate esbuild package for vendor build");
}

const esbuild = createRequire(join(findEsbuildPackage(), "package.json"))(
  "esbuild",
);

const runtimeOut = join(vendorDir, "runtime.js");
await esbuild.build({
  entryPoints: [join(entriesDir, "runtime.mjs")],
  bundle: true,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  format: "iife",
  platform: "browser",
  outfile: runtimeOut,
  logLevel: "silent",
});

const preflight = readFileSync(
  join(root, "node_modules/tailwindcss/preflight.css"),
  "utf8",
);
writeFileSync(
  join(outDir, "tailwind.css"),
  `@layer theme, base, components, utilities;\n\n@layer base {\n${preflight}\n  .atoms-preview-root { min-height: 100vh; }\n}\n`,
);

const tailwindBrowserSrc = join(
  root,
  "node_modules/@tailwindcss/browser/dist/index.global.js",
);
cpSync(tailwindBrowserSrc, join(vendorDir, "tailwind-browser.js"));

console.log("Wrote public/preview/{esbuild.wasm,tailwind.css,vendor/runtime.js,vendor/tailwind-browser.js}");
