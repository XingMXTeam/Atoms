#!/usr/bin/env node
/**
 * Rebuild same-origin preview vendor assets under public/preview/.
 * No CDN — China reachability (REQ-6 / RL-2).
 *
 * Each vendor entry is a self-contained ESM bundle (no cross-imports)
 * so esbuild-wasm can link them without cycles.
 */
import { cpSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const outDir = join(root, "public/preview");
const vendorDir = join(outDir, "vendor");
const entriesDir = join(root, "scripts/preview-vendor-entries");

mkdirSync(vendorDir, { recursive: true });

const wasmSrc = require.resolve("esbuild-wasm/esbuild.wasm");
cpSync(wasmSrc, join(outDir, "esbuild.wasm"));

function runEsbuild(args) {
  const result = spawnSync("pnpm", ["exec", "esbuild", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
}

for (const [entry, outfile] of [
  ["react.mjs", "react.js"],
  ["jsx-runtime.mjs", "jsx-runtime.js"],
  ["react-dom-client.mjs", "react-dom-client.js"],
]) {
  runEsbuild([
    join(entriesDir, entry),
    "--bundle",
    "--format=esm",
    "--platform=browser",
    `--outfile=${join(vendorDir, outfile)}`,
  ]);
}

const preflight = readFileSync(
  join(root, "node_modules/tailwindcss/preflight.css"),
  "utf8",
);
writeFileSync(
  join(outDir, "tailwind.css"),
  `${preflight}\n\n/* Atoms Studio preview utilities (self-hosted; no CDN) */\n.atoms-preview-root { min-height: 100vh; }\n`,
);

console.log("Wrote public/preview/{esbuild.wasm,tailwind.css,vendor/*}");
