---
name: ai-app-sandbox-guardrails
description: Guardrails for AI app generators with sandboxed browser previews, multi-turn iterations, LLM replay fallbacks, version rollback, and anti-false-positive verification. Use when modifying preview sandboxes, agent pipelines, version restore, or workbench E2E tests.
---

# AI App Sandbox & Multi-Turn Guardrails

Checklist to prevent runtime boundary drift, destructive silent fallbacks, state desync, and false-positive tests across AI app generation workflows.

## 1. Sandbox Capability Matrix Checklist

- [ ] **Sync `sandbox` attributes with engineer prompts**: If the preview `<iframe>` omits `allow-same-origin` (required to block host/cookie escape), prompts must forbid `localStorage`, `sessionStorage`, and `document.cookie` (`SecurityError` inside opaque origins).
- [ ] **Forms inside sandbox**: Either include `allow-forms` alongside `allow-scripts` AND instruct generated code to call `e.preventDefault()`, or bind explicit `onClick` handlers so form submission never fails silently.
- [ ] **CSS Cascade & Zero External CDNs**: Emit `@layer theme, base, components, utilities;` before wrapping Tailwind Preflight inside `@layer base { ... }` so `@layer utilities` buttons/badges never lose specificity. Self-host all WASM, React runtimes, and Tailwind browser scripts (never embed external CDN URLs).
- [ ] **Bundle Size & Production Flags**: Build preview React vendor runtimes with `minify: true` and `NODE_ENV="production"` so no legacy duplicate or uncompressed bundles bloat deployment.

## 2. LLM Fallback & Multi-Turn Safety Checklist

- [ ] **Protect existing versions from silent fallback**: If a run starts from an existing `currentVersion` (follow-up iteration or QA self-heal), NEVER silently fall back to hardcoded replay/mock templates when the upstream LLM fails — throw explicitly, leave `currentVersionId` untouched, and surface recovery UI (`继续`).
- [ ] **Propagate initial-run replay labels**: When an initial creation falls back to replay during SSE streaming, attach `providerLabel` to persisted events and notify the client so the replay banner is never missed.
- [ ] **Preserve multi-turn context**: Pass recent message history and `currentFiles` to Planner, Architect, and Engineer on follow-up runs, and preserve the existing project title instead of letting Planner rename the project on every follow-up.

## 3. Version Restore & State Sync Checklist

- [ ] **Atomic client sync on restore**: Updating `currentVersionId` in the DB must immediately update client `files`, `qaScore`, `currentVersionId`, `activeRunId`, clear stale `?run=` URL parameters via `history.replaceState`, and switch focus to the Preview tab.
- [ ] **Distinct feedback**: Render success (`role="status"`) and error (`role="alert"`) restore banners where they stay visible after tab transitions.
- [ ] **Hydration single source of truth**: When `project.currentVersionId` points to a restored version and no active run is in progress, SSR must hydrate initial files from `currentVersion` rather than a stale `?run=` query param.

## 4. Anti-False-Positive Verification Checklist

- [ ] **Real UI interactions in E2E**: Click actual buttons (`恢复此版本`, form submit inside preview iframe) instead of bypassing UI handlers with `page.request.post`.
- [ ] **Positive + negative assertions**: Version rollback tests must assert BOTH that prior content returned AND that rolled-back delta markers disappeared, and must verify persistence across `page.reload()`.
- [ ] **Computed style & interactive checks**: CSS/Tailwind changes must verify real `getComputedStyle` values (non-transparent button backgrounds, padding, colors) rather than DOM text existence alone.
- [ ] **Test DOM cleanup & single schema source**: Register `cleanup()` in Vitest `setupFiles`, and share a single SQL migration file (`migrations/0000_init.sql`) between SQLite tests and D1 production.
