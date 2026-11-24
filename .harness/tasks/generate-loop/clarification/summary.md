# Clarification summary — generate-loop

## Mode

Imported PRD confirmed. Source: `docs/prd/F2-generate-loop.md` → `.harness/tasks/generate-loop/prd.md` (10 requirements, numbering complete). SHORTENED clarify: no PRD rewrite; gaps closed from `docs/plan/decisions.md` (user-approved 2026-11-23) because the product owner is unavailable overnight.

## Goals

End-to-end generation loop: home prompt → create `project`+`run` → SSE Planner→Architect→Engineer → Chinese agent timeline → self-hosted esbuild-wasm preview in a strict sandbox iframe → persist version/messages — all under anonymous `deviceId`.

## Non-goals

QA probe / self-heal / score badge (F3). Iterate patches, version rollback, share link, zip, seed projects (F4). WebContainer / server-side preview bundling. Sign-up / multi-user auth. Pixel-copy of Atoms. External CDN runtime deps.

## Users / roles

Anonymous evaluators and demo visitors scoped by `deviceId` cookie — no sign-up.

## Main path

Visit `/` → enter or pick an example prompt → submit → land on `/projects/[projectId]` → timeline shows Planner→Architect→Engineer → 预览 tab renders mock/generated app in sandboxed iframe → 代码 tab shows file tree + source → refresh home → project listed under 「我的项目」.

## Edge paths

SSE disconnect mid-run → run status `interrupted` + Chinese 「继续」 affordance (known limitation documented). Parse failure of structured Gemini output → one automatic retry. Provider over-cap / transport failure reuses foundation `replay` + 「演示回放」 labelling.

## Data meanings

Reuse foundation tables: `projects`, `messages`, `runs`, `agent_events` (monotonic `seq`), `versions` (`files`, `acceptance`, `summary`), `usage`. On Engineer success set `projects.current_version_id`.

## Stack decision

As the repo + Plan A (D1): Next.js App Router + TypeScript + Tailwind v4 + OpenNext/Workers + Drizzle dual adapters + in-browser `esbuild-wasm` (already a dependency) + sandboxed iframe. No WebContainer. No new UI framework.

## Budgets

`harness.config.json`: maxMacroCycles 5, requiredStablePasses 2, passScore 0.9. Gate commands unchanged; e2e always `LLM_PROVIDER=mock`.

## Quality

Level polished. REF: calm Chinese home + workbench with visible multi-agent timeline and non-blank preview. ANTI: CDN-backed preview, `allow-same-origin` sandbox, English-only agent chrome. Red lines: insecure iframe sandbox; external CDN fetches at preview runtime; blank mock preview / missing Chinese timeline.

## Gaps closed (resolved assumptions)

1. Workbench route → `/projects/[projectId]`. (consistent with App Router + PRD REQ-2)
2. Model ids → `GEMINI_MODEL_FLASH` / `GEMINI_MODEL_PRO` env, documented in `.env.example`. (REQ-8)
3. Code tab → file tree + read-only source viewer in F2; CodeMirror deferred. (REQ-5 wording)
4. 「继续」 → surface affordance + mark `interrupted`; resume is documented known limitation. (REQ-9)
5. ≥4 Chinese example prompt cards fill the central input. (REQ-1)
6. REQ numbering left as imported REQ-1..10.

## Module coverage

| Module | Covered | Where |
|---|---|---|
| 1 goal | yes | imported PRD + D1/D7/D10 |
| 2 users/roles | yes | anonymous deviceId (D6) |
| 3 main path | yes | PRD acceptance + REQ-1..7 |
| 4 error/edge | yes | REQ-8 retry, REQ-9 interrupt, foundation replay |
| 5 data objects | yes | implementation_plan §4 + REQ-3/7 |
| 6 integrations | yes | Gemini SSE server-side, esbuild-wasm |
| 7 non-functional | yes | D10 China reachability, sandbox security |
| 8 non-goals | yes | PRD non-goals |
| 9 acceptance | yes | PRD acceptance + REQ-10 |
| 10 budgets | yes | harness.config.json |
| 11 quality | yes | D8 + vision.md |
| stack | yes | D1/D3 + repo |

confirmed-by-user: yes (2026-11-23, "pre-approved via docs/plan/decisions.md; owner unavailable overnight — treat decisions.md as confirming words for imported F2 PRD")
open-questions: 0
