# Confirmed product & engineering decisions (user-approved, 2026-11-23)

These are the product owner's explicit answers. They are the authoritative
"user answers" for every harness clarify step. Do not re-ask them; any gap
not covered here must be resolved by choosing the option most consistent
with this file and `implementation_plan.md`, and recorded as an assumption.

## Context
- Deliverable: a runnable "Atoms-like" demo for a ROOT full-stack hiring test:
  agent-driven app generation + visual preview of the generated app.
- Hard requirements: real interaction (not static), data persistence, no
  sign-up, a public test URL, core flow + at least one extended capability,
  a short write-up (approach & trade-offs, what is done / not done, next steps).
- Evaluators are likely on mainland-China networks.
- Evaluation dimensions: completeness/stability, engineering thinking,
  UX, innovation, deliverability.

## Decisions
| # | Topic | Decision |
|---|---|---|
| D1 | Plan | **Plan A (stability first)**: in-browser esbuild-wasm bundling, iframe preview. **No WebContainer.** |
| D2 | Focus budget | < 14h total including harness overhead |
| D3 | Stack | **Next.js (App Router) + TypeScript**, deployed to **Cloudflare Workers via @opennextjs/cloudflare** (not vinext) |
| D4 | Domain | **atoms.maoxunxing.com** (zone on the owner's Cloudflare account). Never rely on `*.workers.dev` for evaluators. |
| D5 | LLM | **Gemini** (paid key), server-side only via REST streaming; Worker placement `aws:us-east-1` to avoid unsupported-region (HKG) egress |
| D6 | Persistence | Cloudflare **D1** (+ Drizzle) keyed by anonymous deviceId cookie |
| D7 | Differentiators | (a) multi-agent collaboration made visible: Planner / Architect / Engineer / QA; (b) "generate-then-verify": QA agent checks acceptance criteria + preview probe errors and self-heals (≤3 rounds) |
| D8 | UI direction | Own product perspective, **not** a pixel copy of Atoms. Positioning: "可验证的 AI 应用生成". Chinese UI. Professional, calm, high design quality, restrained refined micro-interactions, high performance. |
| D9 | Harness | **frontend-harness-cli, full loop for every feature**, host = Claude Code |
| D10 | China reachability | No runtime dependency on external CDNs (esm.sh/unpkg/jsdelivr/tailwind CDN/Google Fonts). Self-host esbuild.wasm, vendor ESM bundles for whitelisted deps, tailwind browser build. |
| D11 | Reliability | Provider modes `gemini` / `mock` (deterministic, for e2e) / `replay` (automatic fallback on error/quota, clearly labelled). Rate limit per deviceId + IP, global daily token cap. Seeded example projects for zero-wait first impression. |
| D12 | Repo | https://github.com/XingMXTeam/Atoms (public). Work on branch `feat/atoms-demo` in a git worktree, deliver via PR to `main`. |
| D13 | Confidentiality | The hiring-test brief text must NOT be committed (it forbids redistribution). Paraphrase requirements only. |

## Feature split (harness features, in order)
1. `foundation` — scaffold, OpenNext/Workers config, D1 schema, deviceId, provider abstraction (gemini/mock/replay), rate limit, verify gates (typecheck/lint/vitest/Playwright e2e/build).
2. `generate-loop` — Planner→Architect→Engineer pipeline over SSE, agent timeline UI, esbuild-wasm preview, persistence, home + project list.
3. `qa-self-heal` — iframe probe, QA per-acceptance-criterion verdict, auto-fix loop ≤3 rounds, score badge.
4. `iterate-versions` — follow-up edits as incremental patches, version timeline + rollback, read-only share link, zip download, seed data.
5. `polish` — design system pass, micro-interactions, performance (Lighthouse), accessibility, empty/error/loading states, write-up docs.

Cut order if over budget: zip → share link → mobile preview toggle → merge Planner+Architect (timeline still shows both). Never cut foundation / generate-loop / qa-self-heal.

## Known external blockers (owner action required, do not work around)
- `wrangler login` (OAuth) — not yet done at kickoff.
- `GEMINI_API_KEY` in `.dev.vars` / `wrangler secret put` — owner provides; never commit, never print.
Until then: build and verify everything with the `mock` provider locally; keep deployment scripts ready.
