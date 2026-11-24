# Browser checks — iterate-versions c1-1

- Server: `LLM_PROVIDER=mock pnpm exec next start --port 3000` (trapped; stopped after run).
- Capture: `harness capture iterate-versions --run-id c1-1` → fail (home OK; bracket routes timeout).
- Journey: `node .harness/tasks/iterate-versions/evidence/c1-1-browser/journey.mjs` → ok.
- Verify: `fh verify` all green at `8d8813e` (`typecheck`, `lint`, `unit`, `build`, `e2e`).
- Playwright: 1.65.1; package e2e suite 18 passed including `e2e/iterate-versions.spec.ts`.
