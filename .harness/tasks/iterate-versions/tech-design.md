# Technical design — iterate-versions

## Existing shape

The application is Next.js App Router with server components for home and project loading, client workbench components for interactive tabs, route handlers under `src/app/api`, and a database repository selected by `getDb()` for local SQLite or Worker D1/Drizzle. Project ownership uses the `deviceId` cookie. Versions already store file snapshots, parent IDs, QA scores, and summaries; `projects` carries `currentVersionId` and `shareSlug`. `jszip` is already installed. Follow these patterns and avoid new dependencies.

## Data and repository behavior

- Add repository operations for creating an iteration run, loading current-version files, persisting a successful complete snapshot, listing versions chronologically, selecting the current version, resolving a share slug, and idempotently ensuring seed data.
- Before calling Engineer for a follow-up, load the project with owner `deviceId` scope and its current complete file snapshot. Pass that snapshot into the run context.
- Apply Engineer's changed-file delta to the current snapshot by path. Persist the merged result as a new immutable `versions.files` snapshot with `parentId` set to the previous current version. Persist the run/message data and advance `projects.currentVersionId` only once the new version is committed.
- An empty delta completes as a no-change result and leaves the version pointer unchanged. A failed/incomplete run must not advance the pointer or create a partial snapshot.
- Rollback verifies the target version belongs to the project, then updates only `projects.currentVersionId`. Historical version rows and files remain unchanged.
- Store the share slug on demand using a cryptographically unpredictable opaque token with a uniqueness constraint. Repeated share requests reuse an existing slug. Share resolution returns the project's current complete version snapshot.
- Seed at least two completed example projects with complete version snapshots and QA scores, scoped to a new device or inserted when its home has no projects. Seed insertion is idempotent. Keep the existing four-or-more F2 example prompts.

## Routes and UI

- Extend `src/app/projects/[projectId]/page.tsx` and its workbench client to add the 版本 tab and a chronological timeline. Each row shows summary and QA score. Rollback is an owner-scoped mutation; after success, refresh server data and hydrate both preview and code from the returned current snapshot.
- Add owner-scoped route handlers following existing project API conventions for iteration, version listing/rollback, share creation, and ZIP export. Validate IDs and payloads on the server and scope all owner mutations through `deviceId`.
- Add `/share/[shareSlug]` as a public read-only route. It loads the share slug and current version without consulting the owner cookie, renders preview and code using the same self-hosted preview pipeline, and exposes no mutation controls. Unresolved slugs return not-found.
- Export the current version's path/content pairs as a `.zip` with `jszip`; use safe filenames and a download response. The client can request the current snapshot from the owner-scoped route.
- Keep user-visible labels in Chinese and use existing styles/tokens and immediate pending/error feedback. Use `no-store`/dynamic reads for mutable owner and public version views so rollback or iteration is reflected promptly; no long-lived cache for share content.

## Security and failure handling

Owner routes return 401/403 for missing or mismatched device ownership. Public share reads are limited to preview/code fields and never grant mutations; POST or other mutation calls remain owner-authenticated and return 401/403 without the owner cookie. Validate share slug format and return 404 for unknown values. Rollback rejects a version from another project. Iteration or ZIP failures retain the input and current version and show actionable Chinese feedback. Never allow generated preview code to escape the existing sandbox or load runtime assets from third-party CDNs.

## Verification approach

Use focused repository tests for delta merge, parent/current pointer updates, rollback ownership and immutability, share lookup/authorization, ZIP entry names/content, and seed idempotence. Add Playwright coverage with `LLM_PROVIDER=mock` for the required iterate → second version → rollback journey, a cookie-free read-only share view and mutation denial, ZIP content, and fresh-device seeded home. Run project verification only through the harness verify workflow; the planner does not execute tests.
