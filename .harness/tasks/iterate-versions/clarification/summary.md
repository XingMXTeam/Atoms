# Clarification summary — iterate-versions

The imported PRD `../prd.md` is the feature contract and remains unchanged. The product owner pre-approved the PRD and all decisions in `docs/plan/decisions.md`; all six imported requirement IDs are contiguous (REQ-1 through REQ-6).

## Goal and success

Support incremental follow-up edits on an existing generated project, retain a chronological version history with rollback, provide a read-only share link and current-version ZIP download, and populate a new device's home with completed examples. The core success path is an iteration creating a child version followed by rollback that restores the prior preview and code.

## Users, roles, and permissions

The owner is an anonymous `deviceId` user. They may iterate, inspect versions, roll back, mint a share link, and download a ZIP for their own project. A visitor with a share link can inspect the shared project's preview and code without the owner's cookie; the public view is read-only and mutation requests are denied.

## Main and edge paths

- Follow-up input starts a new run with the current project files; Engineer emits a changed-files delta; a successful delta creates a child `versions` row and advances `projects.current_version_id`.
- The 版本 tab shows newest/chronological version history, summary, QA score, and rollback. Rollback changes the current pointer and reloads preview/code from the selected immutable version.
- Share creation is on demand. The opaque project share slug resolves the current version for public preview/code. Public reads do not require an owner cookie; mutations remain unavailable.
- ZIP download contains all files from the current version.
- A fresh device receives at least two completed example projects, version records and QA scores, plus at least four F2 example prompts.
- If an iteration produces no changed files, it completes with an explicit no-change result and does not create an empty version. This preserves the previous current version.
- Share URLs resolve the project's current version when opened; a later rollback or iteration therefore changes the version shown by the same project share link.

## Data meanings and boundaries

`versions.parent_id` links an iteration to the version used as its input. `versions.files` is a complete snapshot, even when Engineer returns a delta. `projects.current_version_id` identifies the snapshot used by the owner's workbench and the public share view. `share_slug` is an opaque lookup token. QA scores remain associated with their immutable version snapshots. ZIP contents are the current snapshot's path/content pairs.

## Stack and product decisions

Use the existing Next.js App Router + TypeScript application, repository interface backed by D1/Drizzle in Workers and local SQLite in development, existing server-side mock provider for E2E, and installed `jszip` dependency. Keep anonymous `deviceId` ownership, the self-hosted preview, Chinese UI, and the existing no-runtime-CDN constraint. Do not introduce WebContainer, sign-up, or a new provider.

## Budget, quality, and non-goals

The approved plan budgets about two hours for F4 within the overall under-14-hour focus budget. Prioritize correctness, stable iteration and rollback, clear interaction feedback, then visual consistency with the existing calm Chinese-language product UI. Keep permissions, persistence, and accessibility expectations consistent with project standards. Multiplayer editing, Git remotes, paid-plan/quota UI, and F5 pixel polish remain out of scope. The approved cut order remains ZIP, then share, while iteration and rollback stay in scope.

## Quality references and red lines

Positive reference: existing Atoms Studio home and workbench surfaces, extended with a compact version timeline consistent with their card, tab, and QA-score patterns. Avoid generic admin tables, destructive history controls, and a public page that resembles an editable owner workbench. Never lose historical snapshots on rollback; never allow a public share visitor to mutate; never show preview/code from a different version than the selected/current version; never show an empty home grid on first paint.

## Coverage

| Clarification module | Covered | Source |
|---|---|---|
| Goal and success measure | yes | Goal and success; PRD REQ-1, REQ-2, REQ-6 |
| Users, roles, permissions | yes | Users, roles, and permissions; PRD REQ-3 |
| Main path | yes | Main and edge paths; PRD REQ-1, REQ-2, REQ-6 |
| Error and edge paths | yes | Main and edge paths; no-change and public mutation behavior |
| Data objects and field meanings | yes | Data meanings and boundaries |
| Integrations and API boundaries | yes | Stack and product decisions; Data meanings and boundaries |
| Non-functional limits | yes | Stack and product decisions; Budget, quality, and non-goals |
| Non-goals | yes | Budget, quality, and non-goals; imported PRD |
| Acceptance judgment | yes | Goal and success; vision and rubric artifacts |
| Budgets and stop policy | yes | Budget, quality, and non-goals; harness feature plan |
| Quality expectations and references | yes | Quality references and red lines; `vision.md` |
| Stack | yes | Stack and product decisions; `docs/plan/decisions.md` |

Minor assumptions resolved from the approved plan: a no-change delta creates no version; a project share slug resolves the current version at read time; version file snapshots remain complete and immutable.

confirmed-by-user: yes (2026-11-24, "The product owner has pre-approved the PRD and all decisions in docs/plan/decisions.md.")
open-questions: 0
