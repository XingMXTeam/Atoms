# Browser checks — polish c1-1

- Server: `LLM_PROVIDER=mock pnpm exec next start --port 3000` (PID trapped; stopped after evaluation).
- Capture: `harness capture polish --run-id c1-1` → **fail** (1/3 pages) — home OK; literal `/projects/[projectId]` and `/share/[shareSlug]` timeout (known placeholder limitation).
- Journey: `node .harness/tasks/polish/evidence/c1-1-browser/journey.mjs` → ok (real project + share screenshots, E2E-1..8 probes, CDN audit).
- Verify: `fh verify` all green at `5ccf11a` (`typecheck`, `lint`, `unit`, `build`, `e2e`).
- Playwright: 1.65.1; package e2e suite 32 passed including `e2e/polish.spec.ts`.
- Preview asset header spot-check: `GET /preview/esbuild.wasm` → `Cache-Control: public, max-age=31536000, immutable`.
- Clipped-node note: measured clipped count 1 on home is `label.sr-only` (not visible card text).
