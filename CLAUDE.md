<!-- frontend-harness:start -->
## Feature work runs under frontend-harness

- For any feature work, first run `fh` (= `fh next`) and do exactly the action it returns.
- Start a feature with `fh new <name>` (or `fh new <name> --prd <file>`); it becomes the current feature.
- When a step is finished, run `fh done` — it records the right thing for the current phase
  (clarify, task, remediation, replan) and rejects work that has not earned it.
- Never edit `.harness/tasks/*/state.json` by hand, and never declare a feature done yourself:
  only a passing `fh eval` plus the delivery gate can set done.
- "Tests pass" is evidence only as a recorded `fh verify` run; cite its ids, never describe a run.
- After a feature is done, run `fh learn` and show the user any proposal; adopt only with their yes.
- Ask the user only at the clarify confirmation and when the harness pauses.
<!-- frontend-harness:end -->

## Project context (Atoms Demo)

Authoritative decisions live in `docs/plan/decisions.md` and `docs/plan/implementation_plan.md`.
Do not re-ask those; fill gaps with the option most consistent with them and record assumptions.

### Positioning
- Product: **Atoms Studio — 可验证的 AI 应用生成** (Chinese UI).
- Differentiator: generate-then-verify (Planner / Architect / Engineer / QA visible; QA self-heal ≤3 rounds).
- Plan A: in-browser esbuild-wasm + iframe preview. **No WebContainer.**

### Hard constraints
- **China reachability**: no runtime external CDNs (esm.sh / unpkg / jsdelivr / Tailwind CDN / Google Fonts). Self-host `esbuild.wasm`, vendor whitelisted ESM deps, and a Tailwind browser build from our own origin.
- **LLM**: Gemini server-side only (REST streaming). Worker `placement: { region: "aws:us-east-1" }` to avoid unsupported-region egress. Provider modes: `gemini` | `mock` | `replay` (auto-fallback, labelled 演示回放).
- **Auth**: anonymous `deviceId` cookie only — no sign-up.
- **Persistence**: Cloudflare D1 + Drizzle (projects / messages / runs / agent_events / versions / usage). Local Next.js/dev/e2e uses better-sqlite3 (or equivalent) behind the same repository interface.
- **Domain**: `atoms.maoxunxing.com` via OpenNext + Workers. Never rely on `*.workers.dev` for evaluators.
- **Confidentiality**: never commit the hiring-test brief text (redistribution forbidden). Paraphrase requirements only. Never print or commit `GEMINI_API_KEY`.

### Feature order (do not reorder)
1. `foundation` → 2. `generate-loop` → 3. `qa-self-heal` → 4. `iterate-versions` → 5. `polish`

Cut order if over budget: zip → share link → mobile preview toggle → merge Planner+Architect (timeline still shows both). **Never cut F1–F3.**

### Verify
`fh verify` must keep typecheck / lint / unit / e2e / build green. E2E always runs with `LLM_PROVIDER=mock`.
