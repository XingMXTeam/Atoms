# Clarification summary — foundation

## Mode

Imported PRD confirmed. Source: `docs/prd/F1-foundation.md` → `.harness/tasks/foundation/prd.md` (8 requirements, numbering complete). SHORTENED clarify: no PRD rewrite; gaps closed from `docs/plan/decisions.md` (user-approved 2026-11-23) because the product owner is unavailable overnight.

## Goals

Stable base for later features: Next.js App Router + Tailwind v4 Chinese placeholder home, OpenNext/Workers deploy path to `atoms.maoxunxing.com`, Drizzle schema + dual adapters (D1 / better-sqlite3), anonymous `deviceId`, LLM provider modes (`gemini`|`mock`|`replay`), rate caps, documented env, green verify gates.

## Non-goals

Live Gemini in CI/e2e; real `wrangler login` / D1 provisioning; agent pipeline UI; preview bundling; QA; share/zip; pixel-copy of Atoms; external CDN dependencies.

## Users / roles

Anonymous evaluators and demo visitors scoped by `deviceId` cookie — no sign-up.

## Main path

Visit `/` → Chinese product title visible → `deviceId` minted → local SQLite repository usable in tests → provider resolves to `mock` in e2e → `fh verify` records typecheck/lint/unit/e2e/build.

## Edge paths

Over daily run or token cap → degrade to `replay` labelled 「演示回放」, or refuse with a clear Chinese message if replay cannot run. Missing/placeholder D1 id is acceptable until owner provisions.

## Data meanings

Tables: `projects`, `messages`, `runs`, `agent_events`, `versions`, `usage` — all scoped by `device_id` where applicable. Usage tracks per-device daily runs and tokens.

## Stack decision

As the repo: Next.js App Router + TypeScript + Tailwind v4 + OpenNext Cloudflare + Drizzle + better-sqlite3 locally + Workers D1 binding `DB`. No new frameworks.

## Budgets

`harness.config.json`: maxMacroCycles 5, requiredStablePasses 2, passScore 0.9. Gate commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (e2e via verify check with `LLM_PROVIDER=mock`).

## Quality

Level polished. REF: calm Chinese product home. ANTI: Atoms pixel-copy / CDN-dependent landings. Red lines: missing Chinese title; external CDN refs; committed secrets.

## Gaps closed (resolved assumptions)

1. Over-cap → prefer `replay` + 「演示回放」; refuse in Chinese only if replay cannot run. (D11)
2. Local adapter → better-sqlite3. (package.json + REQ-3)
3. Default caps → 20 runs / 500000 tokens. (`.env.example`)
4. Cookie lifetime → ~365 days, HttpOnly, SameSite=Lax.
5. REQ numbering left as imported REQ-1..8.

## Module coverage

| Module | Covered | Where |
|---|---|---|
| 1 goal | yes | imported PRD + decisions D1–D11 |
| 2 users/roles | yes | anonymous deviceId (D6) |
| 3 main path | yes | PRD acceptance criteria |
| 4 error/edge | yes | D11 + gap answers |
| 5 data objects | yes | implementation_plan §4 + REQ-3 |
| 6 integrations | yes | Gemini server-side, OpenNext, D1 |
| 7 non-functional | yes | D4/D10 China reachability, secrets |
| 8 non-goals | yes | PRD non-goals |
| 9 acceptance | yes | PRD acceptance + REQ-8 |
| 10 budgets | yes | harness.config.json |
| 11 quality | yes | D8 + quality-expectations.md |
| stack | yes | D3 + repo |

confirmed-by-user: yes (2026-11-23, "pre-approved via docs/plan/decisions.md; owner unavailable overnight — treat decisions.md as confirming words for imported F1 PRD")
open-questions: 0
