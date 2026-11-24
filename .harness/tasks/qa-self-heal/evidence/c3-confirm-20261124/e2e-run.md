# E2E run — qa-self-heal, cycle 3 confirmation

`fh verify` recorded all project checks passing at HEAD `04d41e0f5b6eeb1250094477ee7593bf0b2c83d0`: `typecheck`, `lint`, `unit`, `e2e`, `build`.

The focused spec was also run directly after stopping the capture server and rebuilding. Command: `CI=1 LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts`.

Result: 3 passed (6.1s), 3 workers:

- streams persisted probe and verdict events into expandable criterion history — PASS;
- recovers from the mock compile error and persists the score badge — PASS;
- shows exhaustion after three repairs and keeps the persisted score — PASS.

An earlier direct run reused a leftover development server from the failed capture and timed out all three cases. That run is invalid for product scoring; the server was stopped, assets rebuilt, and the clean CI-mode run above passed.
