# Clarification summary — polish

The imported PRD `../prd.md` is the feature contract and remains unchanged. The product owner pre-approved the PRD and all decisions in `docs/plan/decisions.md`; all seven imported requirement IDs are contiguous (REQ-1 through REQ-7) with no numbering gaps.

## Goal and success

Raise Atoms Studio from functionally complete F1–F4 to a calm, high-craft, accessible, China-reachable demo: design-system and micro-interaction polish across home + workbench + share, complete empty/loading/error/follow-up UX, performance hardening for preview assets, a desktop/mobile preview width toggle, delivery documentation, and a scripted zero-external-CDN audit. Success means keyboard-accessible primary flows, zero clipped card text at 1280/375, follow-up iteration from the UI under mock E2E, delivery docs without secrets, and a clean CDN network audit plus green `fh verify`.

## Users, roles, and permissions

Anonymous `deviceId` owners use home and the workbench (including follow-up, share, ZIP, preview width toggle). Share visitors remain read-only. No sign-up. Evaluators on mainland-China networks are a first-class audience for reachability and documentation.

## Main and edge paths

- Home, workbench, and share render a coherent light/dark Chinese visual system with restrained motion that disables under `prefers-reduced-motion: reduce`.
- Workbench left rail exposes a Chinese follow-up prompt + send that starts an incremental iteration; disabled while a run is active and absent/disabled on share.
- Workbench metadata reflects persisted `runs.qa_rounds`, including the 3-round cap label `已达修复上限`.
- Empty, loading, error, interrupted (`继续`), rate-limit, Gemini→replay (`演示回放`), and preview compile-error states are clear Chinese copy; ZIP/share show disabled pending feedback.
- Preview tab offers `桌面` / `移动 375px` width toggle while keeping `sandbox="allow-scripts"` only.
- Static `/preview/*` assets get long-term Cache-Control; `esbuild.wasm` may idle-preload; system font stack only (no external font CDNs).
- README + `docs/DELIVERY.md` (+ `docs/writeup.md`) document architecture trade-offs, completion, roadmap, and Cloudflare deploy steps without secrets or brief text.
- Scripted audit records zero runtime requests to `esm.sh`, `unpkg`, `jsdelivr`, `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com` on home/workbench/share.

## Data meanings and boundaries

No new domain entities. Polish consumes existing projects, runs (`qa_rounds`, status), versions, share slugs, and preview file snapshots. Labels `已达修复上限` and `演示回放` are presentation of existing run/provider state. Preview width is client UI state only.

## Stack and product decisions

Stay on Next.js App Router + TypeScript, Tailwind v4, OpenNext/Workers, D1/SQLite repository, self-hosted `/preview/*` (esbuild.wasm, vendor ESM, Tailwind browser CSS), Plan A iframe preview (no WebContainer), provider modes `gemini`/`mock`/`replay`, Chinese UI, anonymous deviceId. No new runtime CDN dependencies.

## Budget, quality, and non-goals

F5 is the final feature in the under-14h plan. Prioritize UX completeness and reachability over decorative motion. Non-goals: new generation capabilities beyond F1–F4, marketing site/blog, committing confidential brief text or secret keys. Cut order remains available if budget forces later omission, but REQ-5 stays in the F5 contract by default.

## Quality references and red lines

Positive: refine the existing Atoms Studio calm card/tab/timeline language. Avoid marketing flash and motion that ignores reduced-motion. Never ship clipped project-card text, unlabeled preview iframe/tabs without focus rings, runtime external CDN fetches, or docs containing secrets/brief text.

## Coverage

| Clarification module | Covered | Source |
|---|---|---|
| Goal and success measure | yes | Goal and success; PRD REQ-1..7 |
| Users, roles, permissions | yes | Users, roles, and permissions |
| Main path | yes | Main and edge paths |
| Error and edge paths | yes | REQ-2 states; reduced-motion; CDN audit |
| Data objects and field meanings | yes | Data meanings and boundaries |
| Integrations and API boundaries | yes | Stack; existing APIs only |
| Non-functional limits | yes | REQ-3, REQ-4, REQ-7; D8/D10 |
| Non-goals | yes | Budget; imported PRD |
| Acceptance judgment | yes | PRD acceptance criteria; vision/rubric |
| Budgets and stop policy | yes | Budget; harness feature plan |
| Quality expectations and references | yes | quality-expectations.md; vision.md |
| Stack | yes | Stack; docs/plan/decisions.md |

Minor assumptions resolved from the approved plan: keep mobile preview toggle; place follow-up in the workbench left rail; use system fonts only; verify CDN absence via scripted E2E/network checks; Chinese section headings in delivery docs.

confirmed-by-user: yes (2026-11-24, "The product owner has pre-approved the PRD and all decisions in docs/plan/decisions.md.")
open-questions: 0
