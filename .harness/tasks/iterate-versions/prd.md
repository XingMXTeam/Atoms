# F4 — Iterate & Versions

Follow-up edits as incremental patches, version timeline with rollback, read-only share links, zip download, and seeded demo projects.

## Requirements

- **REQ-1** Follow-up user messages on an existing project start a new `run` that sends current files to Engineer; Engineer returns only changed files; a new `versions` row is created with `parent_id` pointing at the previous version.
- **REQ-2** Workbench **版本** tab: chronological timeline of versions with summary, `qa_score` badge, and a **回滚** action that sets `projects.current_version_id` and refreshes preview/code to that snapshot (no destructive delete).
- **REQ-3** Read-only share link: `projects.share_slug` minted on demand; public route loads that version's preview + code without requiring the owner's `deviceId` cookie (mutations disabled).
- **REQ-4** **下载 zip** exports the current version's files as a `.zip` (jszip) from the browser or a route handler.
- **REQ-5** Seed data: ≥2 completed example projects (with versions + QA scores) inserted for every new `deviceId` (or on empty home) so first paint is never a blank grid; plus the ≥4 example prompts from F2.
- **REQ-6** E2E uiJourney (`LLM_PROVIDER=mock`): iterate with a follow-up → new version appears → rollback restores prior preview content.

## Non-goals

- Real-time collaborative multiplayer editing.
- Git remotes / pushing generated apps to GitHub.
- Paid plan / quota UI beyond existing rate limits.
- Pixel-perfect design polish (F5).

## Acceptance criteria

1. Mock e2e: after initial generate, send follow-up → timeline shows a second version → rollback → preview matches version-1 mock content.
2. Share URL opened in a fresh browser context (no owner cookie) renders read-only preview; POST/mutate endpoints return 401/403.
3. Zip download contains all files from `versions.files` for the current version (asserted in unit or e2e via downloaded artifact names).
4. Fresh `deviceId` landing on `/` sees ≥2 seeded projects with score badges without running a generation.
5. `fh verify` remains green; cut-order note: if timeboxed, zip then share may be deferred — document in write-up, keep iterate+rollback.
