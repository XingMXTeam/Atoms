# TASK-3 developer report

- **Task:** Preview performance headers, idle wasm preload, and mobile width toggle
- **Commit:** `ed02152`
- **Files:** `next.config.ts`, `src/lib/preview/cache-headers.ts`, `src/lib/preview/cache-headers.test.ts`, `src/lib/preview/preload.ts`, `src/lib/preview/preload.test.ts`, `src/lib/preview/width.ts`, `src/lib/preview/width.test.ts`, `src/components/workbench/preview-pane.tsx`, `e2e/polish.spec.ts`
- **Checks:**
  - `pnpm exec vitest run src/lib/preview` — 7 files / 18 tests passed.
  - `LLM_PROVIDER=mock pnpm exec playwright test e2e/polish.spec.ts --grep "preview-width|sandbox"` — 2 passed (after `next build`).
  - `pnpm typecheck` — passed.
- **Implementation:**
  - Added `previewAssetHeaderRules()` / `PREVIEW_CACHE_CONTROL` and wired them through `next.config.ts` `headers()` so `/preview/:path*` gets long-lived immutable Cache-Control (REQ-4).
  - Added `scheduleEsbuildWasmPreload()` (`requestIdleCallback` with timer fallback) and invoke it from `PreviewPane` on mount.
  - Added `桌面` / `移动 375px` width toggle on the ready preview pane; mobile constrains `preview-frame` to 375px max-width while iframe sandbox stays `allow-scripts` only (REQ-5).
- **Contract decisions:** Width preference is client UI state only (not persisted). Preload is best-effort and cancelable; fetch failures are ignored. No new dependencies.
