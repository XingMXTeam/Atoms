# Clarification summary — qa-self-heal

- confirmed-by-user: yes
- open-questions: 0
- confirmed-on: 2026-11-23
- source: Product owner pre-approved the imported PRD and all decisions in `docs/plan/decisions.md`; the shortened clarify packet records a complete REQ-1 through REQ-7 sequence with no numbering gaps.

## Confirmation

The imported `prd.md` is confirmed as the feature contract without rewriting or renumbering it. All seven requirements and the PRD's stated non-goals and acceptance criteria are accepted.

## Resolved assumptions

- QA uses the existing server-side LLM provider abstraction and Flash-class model routing; E2E remains deterministic with `LLM_PROVIDER=mock`.
- The probe report crosses the sandboxed preview boundary using validated `postMessage` data. It reports compile/runtime errors, blank-screen state, and a bounded DOM summary without granting the iframe host-origin access.
- Existing home (`/`) and workbench (`/projects/[projectId]`) are the surfaces for project-card and workbench badges; workbench captures require a project created in the same authenticated deviceId browser context.
- A run may finish after all criteria pass or after the third fix attempt is exhausted. The last version and score remain persisted on exhaustion, with the Chinese exhausted state specified by the PRD.
- Existing repo test and verification commands remain authoritative; no new framework is assumed.
